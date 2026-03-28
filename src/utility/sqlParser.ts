import { Parser } from "node-sql-parser";
import { EntityDefinition } from "../binding/model/EntityDefinition";

const parser = new Parser();
const PARSE_OPTIONS = { database: "TransactSQL" } as const;

const normalizeTableName = (input: string) =>
    input.replace(/^[\[\"]+|[\]\"]+$/g, "").toLowerCase();

export type SqlTableRef = {
    raw: string;
    normalized: string;
    logicalName?: string;
    aliases: string[];
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

export type SqlStatementSlice = {
    text: string;
    startOffset: number;
    endOffset: number;
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
    const tableRef: SqlTableRef = {
        raw,
        normalized,
        logicalName,
        aliases: alias ? [alias] : [],
    };
    tables.push(tableRef);
    aliases[normalized] = tableRef;
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

const STATEMENT_START_PATTERN = /(^|[\r\n])(\s*)(select|update|delete|insert)\b/gi;

export const isolateSqlStatementAtOffset = (
    sql: string,
    cursorOffset: number
): SqlStatementSlice => {
    if (!sql.length) {
        return { text: "", startOffset: 0, endOffset: 0 };
    }

    const boundedCursor = Math.max(0, Math.min(cursorOffset, sql.length));
    const previousSemicolon = sql.lastIndexOf(";", Math.max(boundedCursor - 1, 0));
    const nextSemicolon = sql.indexOf(";", boundedCursor);
    const segmentStart = previousSemicolon === -1 ? 0 : previousSemicolon + 1;
    const segmentEnd = nextSemicolon === -1 ? sql.length : nextSemicolon;
    const segmentText = sql.slice(segmentStart, segmentEnd);
    const cursorInSegment = boundedCursor - segmentStart;

    const starts: number[] = [];
    for (const match of segmentText.matchAll(STATEMENT_START_PATTERN)) {
        const keywordOffset = match.index ?? 0;
        const leadingBoundary = match[1]?.length ?? 0;
        const indentation = match[2]?.length ?? 0;
        starts.push(keywordOffset + leadingBoundary + indentation);
    }

    if (starts.length === 0) {
        return {
            text: segmentText,
            startOffset: segmentStart,
            endOffset: segmentEnd,
        };
    }

    let activeStart = starts[0];
    for (const start of starts) {
        if (start <= cursorInSegment) {
            activeStart = start;
        } else {
            break;
        }
    }

    const nextStart = starts.find((start) => start > Math.max(cursorInSegment, activeStart));
    const statementStart = segmentStart + activeStart;
    const statementEnd = nextStart === undefined ? segmentEnd : segmentStart + nextStart;

    return {
        text: sql.slice(statementStart, statementEnd),
        startOffset: statementStart,
        endOffset: statementEnd,
    };
};

export const analyzeSql = (
    sql: string,
    entityDefinitions?: EntityDefinition[]
): { context: SqlParseContext | null; error?: SqlParseError } => {
    if (!sql.trim()) {
        return { context: null };
    }

    try {
        const ast = parser.astify(sql, PARSE_OPTIONS);
        const nameMap = buildEntityNameMap(entityDefinitions);
        const nodes = Array.isArray(ast) ? ast : [ast];
        const mergedContext: SqlParseContext = { tables: [], aliases: {} };

        for (const node of nodes) {
            const context = collectTablesFromAst(node, nameMap);
            mergedContext.tables.push(...context.tables);
            Object.assign(mergedContext.aliases, context.aliases);
        }

        const context = mergedContext;
        return { context };
    } catch (error) {
        return { context: null, error: extractParserError(error) };
    }
};
