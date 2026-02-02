import { Parser } from "node-sql-parser";
import { EntityDefinition } from "../binding/model/EntityDefinition";

const parser = new Parser();

const normalizeTableName = (input: string) =>
    input.replace(/^[\[\"]+|[\]\"]+$/g, "").toLowerCase();

export type SqlTableRef = {
    raw: string;
    normalized: string;
    logicalName?: string;
};

export type SqlParseContext = {
    tables: SqlTableRef[];
    aliases: Record<string, SqlTableRef>;
};

export type SqlParseError = {
    message: string;
    line?: number;
    column?: number;
};

const buildEntityNameMap = (entityDefinitions?: EntityDefinition[]) => {
    const map = new Map<string, string>();
    if (!entityDefinitions?.length) return map;
    for (const definition of entityDefinitions) {
        if (definition.LogicalName) {
            map.set(normalizeTableName(definition.LogicalName), definition.LogicalName);
        }
        if (definition.SchemaName) {
            map.set(normalizeTableName(definition.SchemaName), definition.LogicalName);
        }
        if (definition.EntitySetName) {
            map.set(normalizeTableName(definition.EntitySetName), definition.LogicalName);
        }
    }
    return map;
};

const extractParserError = (error: unknown): SqlParseError => {
    if (error instanceof Error) {
        const anyError = error as unknown as {
            message?: string;
            line?: number;
            column?: number;
            location?: { start?: { line?: number; column?: number } };
        };
        return {
            message: anyError.message ?? "Failed to parse SQL.",
            line: anyError.line ?? anyError.location?.start?.line,
            column: anyError.column ?? anyError.location?.start?.column,
        };
    }
    return { message: "Failed to parse SQL." };
};

const pushTable = (
    raw: string | undefined,
    alias: string | undefined,
    nameMap: Map<string, string>,
    tables: SqlTableRef[],
    aliases: Record<string, SqlTableRef>
) => {
    if (!raw) return;
    const normalized = normalizeTableName(raw);
    const logicalName = nameMap.get(normalized);
    const tableRef: SqlTableRef = { raw, normalized, logicalName };
    tables.push(tableRef);
    if (alias) {
        aliases[normalizeTableName(alias)] = tableRef;
    }
};

const collectTablesFromAst = (
    ast: unknown,
    nameMap: Map<string, string>
): SqlParseContext => {
    const tables: SqlTableRef[] = [];
    const aliases: Record<string, SqlTableRef> = {};
    const visited = new WeakSet<object>();

    const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (typeof node !== "object") return;
        if (visited.has(node as object)) return;
        visited.add(node as object);

        const record = node as Record<string, unknown>;
        if ("from" in record) {
            const fromValue = record.from as unknown;
            if (Array.isArray(fromValue)) {
                fromValue.forEach((item) => walkFromItem(item));
            } else if (fromValue) {
                walkFromItem(fromValue);
            }
        }

        if ("join" in record) {
            walk(record.join);
        }

        for (const value of Object.values(record)) {
            walk(value);
        }
    };

    const walkFromItem = (item: unknown) => {
        if (!item) return;
        if (Array.isArray(item)) {
            item.forEach(walkFromItem);
            return;
        }
        if (typeof item !== "object") return;

        const record = item as Record<string, unknown>;
        if ("column" in record) {
            return;
        }

        if ("table" in record) {
            const raw = record.table as string | undefined;
            const alias = (record.as ?? record.alias) as string | undefined;
            pushTable(raw, alias, nameMap, tables, aliases);
        }

        if ("from" in record || "join" in record) {
            walk(item);
        }

        if ("subquery" in record) {
            walk(record.subquery);
        }
    };

    walk(ast);
    return { tables, aliases };
};

export const analyzeSql = (
    sql: string,
    entityDefinitions?: EntityDefinition[]
): { context: SqlParseContext | null; error?: SqlParseError } => {
    if (!sql.trim()) {
        return { context: null };
    }

    try {
        const ast = parser.astify(sql);
        const root = Array.isArray(ast) ? ast[0] : ast;
        const nameMap = buildEntityNameMap(entityDefinitions);
        const context = collectTablesFromAst(root, nameMap);
        return { context };
    } catch (error) {
        return { context: null, error: extractParserError(error) };
    }
};
