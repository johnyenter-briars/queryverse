import type { editor as MonacoEditor, Position, languages } from "monaco-editor";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { EntityAttribute } from "../binding/model/EntityAttribute";
import { SqlParseContext } from "./sqlParser";

const normalizeTableName = (input: string) =>
    input.replace(/^[\[\"]+|[\]\"]+$/g, "").toLowerCase();

export const findSelectedEntity = (
    text: string,
    entityDefinitions?: EntityDefinition[]
): string | null => {
    if (!entityDefinitions?.length) return null;
    const matches = [...text.matchAll(/\bfrom\s+([A-Za-z0-9_\[\]\"]+)/gi)];
    if (matches.length === 0) return null;
    const rawName = matches[matches.length - 1]?.[1];
    if (!rawName) return null;
    const normalized = normalizeTableName(rawName);
    const match = entityDefinitions.find((definition) => {
        const logical = normalizeTableName(definition.LogicalName);
        const schema = normalizeTableName(definition.SchemaName);
        const entitySet = normalizeTableName(definition.EntitySetName);
        return normalized === logical || normalized === schema || normalized === entitySet;
    });
    return match?.LogicalName ?? null;
};

export const isInSelectList = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const selectIndex = lower.lastIndexOf("select", cursorOffset);
    if (selectIndex === -1) return false;
    const fromIndex = lower.indexOf("from", selectIndex);
    if (fromIndex !== -1 && cursorOffset > fromIndex) return false;
    return true;
};

const findNextKeyword = (text: string, start: number, keywords: string[]) => {
    let next = -1;
    for (const keyword of keywords) {
        const index = text.indexOf(keyword, start);
        if (index !== -1 && (next === -1 || index < next)) {
            next = index;
        }
    }
    return next;
};

export const isInWhereClause = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const whereIndex = lower.lastIndexOf("where", cursorOffset);
    if (whereIndex === -1) return false;
    const fromIndex = lower.lastIndexOf("from", whereIndex);
    if (fromIndex === -1) return false;
    const nextKeyword = findNextKeyword(lower, whereIndex + 5, [
        "order by",
        "group by",
        "having",
    ]);
    if (nextKeyword !== -1 && cursorOffset > nextKeyword) return false;
    return cursorOffset >= whereIndex + 5;
};

const isInUpdateWhereClause = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const whereIndex = lower.lastIndexOf("where", cursorOffset);
    if (whereIndex === -1) return false;
    const updateIndex = lower.lastIndexOf("update", whereIndex);
    if (updateIndex === -1) return false;
    const nextKeyword = findNextKeyword(lower, whereIndex + 5, [
        "order by",
        "group by",
        "having",
    ]);
    if (nextKeyword !== -1 && cursorOffset > nextKeyword) return false;
    return cursorOffset >= whereIndex + 5;
};
const isInUpdateTarget = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const updateIndex = lower.lastIndexOf("update", cursorOffset);
    if (updateIndex === -1) return false;
    const setIndex = lower.indexOf("set", updateIndex);
    if (setIndex !== -1 && cursorOffset > setIndex) return false;
    return cursorOffset >= updateIndex + 6;
};

const isInSetClause = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const setIndex = lower.lastIndexOf("set", cursorOffset);
    if (setIndex === -1) return false;
    const updateIndex = lower.lastIndexOf("update", setIndex);
    if (updateIndex === -1) return false;
    const nextKeyword = findNextKeyword(lower, setIndex + 3, [
        "where",
        "order by",
        "group by",
        "having",
    ]);
    if (nextKeyword !== -1 && cursorOffset > nextKeyword) return false;
    return cursorOffset >= setIndex + 3;
};

const findUpdateTargetEntity = (
    text: string,
    entityDefinitions?: EntityDefinition[]
) => findUpdateEntity(text, entityDefinitions);

export const findUpdateEntity = (
    text: string,
    entityDefinitions?: EntityDefinition[]
): string | null => {
    if (!entityDefinitions?.length) return null;
    const matches = [...text.matchAll(/\bupdate\s+([A-Za-z0-9_\[\]\"]+)/gi)];
    if (matches.length === 0) return null;
    const rawName = matches[matches.length - 1]?.[1];
    if (!rawName) return null;
    const normalized = normalizeTableName(rawName);
    const match = entityDefinitions.find((definition) => {
        const logical = normalizeTableName(definition.LogicalName);
        const schema = normalizeTableName(definition.SchemaName);
        const entitySet = normalizeTableName(definition.EntitySetName);
        return normalized === logical || normalized === schema || normalized === entitySet;
    });
    return match?.LogicalName ?? null;
};

const isInJoinOnClause = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const onIndex = lower.lastIndexOf(" on ", cursorOffset);
    if (onIndex === -1) return false;
    const joinIndex = lower.lastIndexOf("join", onIndex);
    if (joinIndex === -1) return false;
    const nextKeyword = findNextKeyword(lower, onIndex + 4, [
        "where",
        "order by",
        "group by",
        "having",
    ]);
    if (nextKeyword !== -1 && cursorOffset > nextKeyword) return false;
    return cursorOffset >= onIndex + 4;
};

export const getSqlTableNames = (entityDefinitions?: EntityDefinition[]) => {
    if (!entityDefinitions?.length) return [];
    const names = new Set<string>();
    for (const definition of entityDefinitions) {
        if (definition.LogicalName) names.add(definition.LogicalName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
};

type SqlCompletionContext = {
    monaco: typeof import("monaco-editor");
    model: MonacoEditor.ITextModel;
    position: Position;
    entityDefinitions: EntityDefinition[];
    entityAttributes?: Record<string, EntityAttribute[]>;
    tableNames?: string[];
    parseContext?: SqlParseContext | null;
};

const getAliasContext = (textUpToCursor: string) => {
    const match = textUpToCursor.match(
        /([A-Za-z0-9_\[\]\"]+)\.([A-Za-z0-9_\[\]\"]*)$/i
    );
    if (!match) return null;
    return { alias: match[1], columnPrefix: match[2] ?? "" };
};

export const getSqlCompletionItems = ({
    monaco,
    model,
    position,
    entityDefinitions,
    entityAttributes,
    tableNames,
    parseContext,
}: SqlCompletionContext): languages.CompletionItem[] => {
    if (!entityDefinitions?.length) return [];
    const suggestions: languages.CompletionItem[] = [];
    const names = tableNames?.length ? tableNames : getSqlTableNames(entityDefinitions);

    const lineText = model.getLineContent(position.lineNumber);
    const prefix = lineText.slice(0, Math.max(position.column - 1, 0));
    const fullText = model.getValue();
    const cursorOffset = model.getOffsetAt(position);
    const textUpToCursor = fullText.slice(0, cursorOffset);

    const match = prefix.match(/\bfrom\s+([A-Za-z0-9_\[\]\"]*)$/i);
    const joinMatch = textUpToCursor.match(
        /(?:^|\s)(?:inner|left|right|full|outer)?\s*join\s+([A-Za-z0-9_\[\]\"]*)$/i
    );
    const updateMatch = prefix.match(/\bupdate\s+([A-Za-z0-9_\[\]\"]*)$/i);

    if (match || joinMatch || updateMatch) {
        const current = (joinMatch?.[1] ?? match?.[1] ?? updateMatch?.[1] ?? "");
        const range = new monaco.Range(
            position.lineNumber,
            position.column - current.length,
            position.lineNumber,
            position.column
        );

        suggestions.push(
            ...names
                .filter((name) => name.toLowerCase().startsWith(current.toLowerCase()))
                .map((name) => ({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: name,
                    range,
                }))
        );
    }

    const aliasContext = getAliasContext(textUpToCursor);
    if (aliasContext && entityAttributes) {
        const aliasKey = normalizeTableName(aliasContext.alias);
        const target = parseContext?.aliases?.[aliasKey];
        const logicalName = target?.logicalName;
        const attributes = logicalName ? entityAttributes[logicalName] : undefined;
        if (attributes?.length) {
            const range = new monaco.Range(
                position.lineNumber,
                position.column - aliasContext.columnPrefix.length,
                position.lineNumber,
                position.column
            );
            const current = aliasContext.columnPrefix.toLowerCase();
            suggestions.push(
                ...attributes
                    .filter(
                        (attribute) =>
                            attribute.LogicalName.toLowerCase().startsWith(current) ||
                            attribute.SchemaName.toLowerCase().startsWith(current)
                    )
                    .map((attribute) => ({
                        label: attribute.LogicalName,
                        detail: attribute.AttributeType ?? undefined,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: attribute.LogicalName,
                        range,
                    }))
            );
        }
        if (suggestions.length) return suggestions;
    }

    const isInJoinOn = isInJoinOnClause(fullText, cursorOffset);
    if (
        parseContext?.tables?.length &&
        (isInSelectList(fullText, cursorOffset) ||
            isInWhereClause(fullText, cursorOffset) ||
            isInJoinOn)
    ) {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
        );
        const current = word.word.toLowerCase();

        const aliasCandidates = new Map<string, string>();
        for (const table of parseContext.tables) {
            if (table.raw) {
                aliasCandidates.set(table.raw, table.raw);
            }
            for (const alias of table.aliases) {
                aliasCandidates.set(alias, alias);
            }
        }

        suggestions.push(
            ...Array.from(aliasCandidates.keys())
                .filter((name) => name.toLowerCase().startsWith(current))
                .map((name) => ({
                    label: name,
                    kind: monaco.languages.CompletionItemKind.Struct,
                    insertText: name,
                    range,
                }))
        );

        if (suggestions.length) return suggestions;
    }

    const inUpdateSet = isInSetClause(fullText, cursorOffset);
    const inUpdateWhere = isInUpdateWhereClause(fullText, cursorOffset);
    if (
        entityAttributes &&
        (isInSelectList(fullText, cursorOffset) ||
            isInWhereClause(fullText, cursorOffset) ||
            inUpdateSet ||
            inUpdateWhere)
    ) {
        if (inUpdateSet || inUpdateWhere) {
            const updateTarget =
                parseContext?.tables?.[0]?.logicalName ??
                findUpdateTargetEntity(fullText, entityDefinitions);
            const attributes = updateTarget
                ? entityAttributes[updateTarget]
                : undefined;
            if (attributes?.length) {
                const word = model.getWordUntilPosition(position);
                const range = new monaco.Range(
                    position.lineNumber,
                    word.startColumn,
                    position.lineNumber,
                    word.endColumn
                );
                const current = word.word.toLowerCase();

                suggestions.push(
                    ...attributes
                        .filter(
                            (attribute) =>
                                attribute.LogicalName.toLowerCase().startsWith(current) ||
                                attribute.SchemaName.toLowerCase().startsWith(current)
                        )
                        .map((attribute) => ({
                            label: attribute.LogicalName,
                            detail: attribute.AttributeType ?? undefined,
                            kind: monaco.languages.CompletionItemKind.Field,
                            insertText: attribute.LogicalName,
                            range,
                        }))
                );

                if (suggestions.length) return suggestions;
            }
        }

        const tablesInScope = parseContext?.tables?.length
            ? parseContext.tables
                  .map((table) => table.logicalName)
                  .filter((name): name is string => Boolean(name))
            : [];

        const selectedEntity =
            tablesInScope.length === 1
                ? tablesInScope[0]
                : findSelectedEntity(fullText, entityDefinitions);

        const attributes = selectedEntity ? entityAttributes[selectedEntity] : undefined;
        if (attributes?.length) {
            const word = model.getWordUntilPosition(position);
            const range = new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
            );
            const current = word.word.toLowerCase();

            suggestions.push(
                ...attributes
                    .filter(
                        (attribute) =>
                            attribute.LogicalName.toLowerCase().startsWith(current) ||
                            attribute.SchemaName.toLowerCase().startsWith(current)
                    )
                    .map((attribute) => ({
                        label: attribute.LogicalName,
                        detail: attribute.AttributeType ?? undefined,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: attribute.LogicalName,
                        range,
                    }))
            );
        }
    }

    return suggestions;
};
