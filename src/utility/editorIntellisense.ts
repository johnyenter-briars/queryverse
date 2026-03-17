import type { editor as MonacoEditor, Position, languages } from "monaco-editor";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { EntityAttribute } from "../binding/model/EntityAttribute";
import { SqlParseContext } from "./sqlParser";

/**
 * Normalize a table or alias identifier for case-insensitive matching.
 * @param input Raw identifier text.
 * @returns Normalized identifier.
 */
const normalizeTableName = (input: string) =>
    input.replace(/^[\[\"]+|[\]\"]+$/g, "").toLowerCase();

const getEntityDefinition = (
    logicalName: string,
    entityDefinitions?: EntityDefinition[]
): EntityDefinition | undefined =>
    entityDefinitions?.find(
        (definition) =>
            normalizeTableName(definition.LogicalName) === normalizeTableName(logicalName)
    );

const getAttributesForIntellisense = (
    logicalName: string | null | undefined,
    entityDefinitions?: EntityDefinition[],
    entityAttributes?: Record<string, EntityAttribute[]>
): EntityAttribute[] | undefined => {
    if (!logicalName || !entityAttributes) return undefined;

    const merged: EntityAttribute[] = [];
    const seen = new Set<string>();
    const pushAttributes = (attributes?: EntityAttribute[]) => {
        if (!attributes?.length) return;
        for (const attribute of attributes) {
            const key = `${attribute.LogicalName.toLowerCase()}::${attribute.SchemaName.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(attribute);
        }
    };

    pushAttributes(entityAttributes[logicalName]);

    const definition = getEntityDefinition(logicalName, entityDefinitions);

    if (definition?.IsActivity) {
        pushAttributes(entityAttributes.activitypointer);
    }

    return merged;
};

/**
 * Resolve the primary entity from the last FROM clause in the SQL text.
 * @param text Full SQL text.
 * @param entityDefinitions Known entity metadata.
 * @returns Logical entity name or null.
 */
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

/**
 * Determine whether the cursor is positioned inside the SELECT list.
 * @param text Full SQL text.
 * @param cursorOffset Cursor offset in the text.
 * @returns True when inside the SELECT list.
 */
export const isInSelectList = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const selectIndex = lower.lastIndexOf("select", cursorOffset);
    if (selectIndex === -1) return false;
    const fromIndex = lower.indexOf("from", selectIndex);
    if (fromIndex !== -1 && cursorOffset > fromIndex) return false;
    return true;
};

/**
 * Find the next occurrence of any keyword after a given index.
 * @param text Full SQL text (lowercase expected by caller).
 * @param start Start index.
 * @param keywords Keywords to search for.
 * @returns Index of the next keyword or -1.
 */
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

/**
 * Determine whether the cursor is positioned inside a SELECT ... WHERE clause.
 * @param text Full SQL text.
 * @param cursorOffset Cursor offset in the text.
 * @returns True when inside a SELECT WHERE clause.
 */
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

/**
 * Determine whether the cursor is positioned inside an UPDATE ... WHERE clause.
 * @param text Full SQL text.
 * @param cursorOffset Cursor offset in the text.
 * @returns True when inside an UPDATE WHERE clause.
 */
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

/**
 * Determine whether the cursor is positioned inside a DELETE ... WHERE clause.
 * @param text Full SQL text.
 * @param cursorOffset Cursor offset in the text.
 * @returns True when inside a DELETE WHERE clause.
 */
const isInDeleteWhereClause = (text: string, cursorOffset: number) => {
    const lower = text.toLowerCase();
    const whereIndex = lower.lastIndexOf("where", cursorOffset);
    if (whereIndex === -1) return false;
    const deleteIndex = lower.lastIndexOf("delete", whereIndex);
    if (deleteIndex === -1) return false;
    const nextKeyword = findNextKeyword(lower, whereIndex + 5, [
        "order by",
        "group by",
        "having",
    ]);
    if (nextKeyword !== -1 && cursorOffset > nextKeyword) return false;
    return cursorOffset >= whereIndex + 5;
};

/**
 * Determine whether the cursor is positioned inside an UPDATE ... SET clause.
 * @param text Full SQL text.
 * @param cursorOffset Cursor offset in the text.
 * @returns True when inside an UPDATE SET clause.
 */
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

/**
 * Resolve the update target entity from the last UPDATE clause in the SQL text.
 * @param text Full SQL text.
 * @param entityDefinitions Known entity metadata.
 * @returns Logical entity name or null.
 */
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

/**
 * Resolve the delete target entity from the last DELETE clause in the SQL text.
 * @param text Full SQL text.
 * @param entityDefinitions Known entity metadata.
 * @returns Logical entity name or null.
 */
export const findDeleteEntity = (
    text: string,
    entityDefinitions?: EntityDefinition[]
): string | null => {
    if (!entityDefinitions?.length) return null;
    const matches = [
        ...text.matchAll(/\bdelete\s+(?:from\s+)?([A-Za-z0-9_\[\]\"]+)/gi),
    ];
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

/**
 * Map an UPDATE target to a logical entity name, if possible.
 * @param text Full SQL text.
 * @param entityDefinitions Known entity metadata.
 * @returns Logical entity name or null.
 */
const findUpdateTargetEntity = (
    text: string,
    entityDefinitions?: EntityDefinition[]
) => findUpdateEntity(text, entityDefinitions);

/**
 * Determine whether the cursor is positioned inside a JOIN ... ON clause.
 * @param text Full SQL text.
 * @param cursorOffset Cursor offset in the text.
 * @returns True when inside a JOIN ON clause.
 */
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

/**
 * Extract distinct logical table names from entity definitions.
 * @param entityDefinitions Known entity metadata.
 * @returns Sorted logical table names.
 */
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

/**
 * Detect an alias prefix pattern (e.g., `a.`) and return its context.
 * @param textUpToCursor SQL text up to the cursor.
 * @returns Alias context or null.
 */
const getAliasContext = (textUpToCursor: string) => {
    const match = textUpToCursor.match(
        /([A-Za-z0-9_\[\]\"]+)\.([A-Za-z0-9_\[\]\"]*)$/i
    );
    if (!match) return null;
    return { alias: match[1], columnPrefix: match[2] ?? "" };
};

/**
 * Build completion items for SQL based on cursor position and parse context.
 * @param params Completion context inputs.
 * @returns Monaco completion items.
 */
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

    // Cursor and text context for completion decisions.
    const lineText = model.getLineContent(position.lineNumber);
    const prefix = lineText.slice(0, Math.max(position.column - 1, 0));
    const fullText = model.getValue();
    const cursorOffset = model.getOffsetAt(position);
    const textUpToCursor = fullText.slice(0, cursorOffset);

    // Table name suggestions after FROM/JOIN/UPDATE/DELETE targets.
    const match = prefix.match(/\bfrom\s+([A-Za-z0-9_\[\]\"]*)$/i);
    const joinMatch = textUpToCursor.match(
        /(?:^|\s)(?:inner|left|right|full|outer)?\s*join\s+([A-Za-z0-9_\[\]\"]*)$/i
    );
    const updateMatch = prefix.match(/\bupdate\s+([A-Za-z0-9_\[\]\"]*)$/i);
    const deleteMatch = prefix.match(
        /\bdelete\s+(?:from\s+)?([A-Za-z0-9_\[\]\"]*)$/i
    );

    if (match || joinMatch || updateMatch || deleteMatch) {
        const current =
            (joinMatch?.[1] ??
                match?.[1] ??
                updateMatch?.[1] ??
                deleteMatch?.[1] ??
                "");
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

    // Column suggestions after a recognized alias/table prefix (e.g., `a.`).
    const aliasContext = getAliasContext(textUpToCursor);
    if (aliasContext && entityAttributes) {
        const aliasKey = normalizeTableName(aliasContext.alias);
        const target = parseContext?.aliases?.[aliasKey];
        const logicalName = target?.logicalName;
        const attributes = getAttributesForIntellisense(
            logicalName,
            entityDefinitions,
            entityAttributes
        );
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

    // Alias/table suggestions inside select/where/join-on clauses.
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

    // Column suggestions for SELECT/WHERE/SET contexts without an alias prefix.
    const inUpdateSet = isInSetClause(fullText, cursorOffset);
    const inUpdateWhere = isInUpdateWhereClause(fullText, cursorOffset);
    const inDeleteWhere = isInDeleteWhereClause(fullText, cursorOffset);
    if (
        entityAttributes &&
        (isInSelectList(fullText, cursorOffset) ||
            isInWhereClause(fullText, cursorOffset) ||
            inUpdateSet ||
            inUpdateWhere ||
            inDeleteWhere)
    ) {
        if (inUpdateSet || inUpdateWhere || inDeleteWhere) {
            const updateTarget = inDeleteWhere
                ? findDeleteEntity(fullText, entityDefinitions)
                : parseContext?.tables?.[0]?.logicalName ??
                  findUpdateTargetEntity(fullText, entityDefinitions);
            const attributes = getAttributesForIntellisense(
                updateTarget,
                entityDefinitions,
                entityAttributes
            );
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

        // Default column suggestions for single-table or inferred entity context.
        const tablesInScope = parseContext?.tables?.length
            ? parseContext.tables
                  .map((table) => table.logicalName)
                  .filter((name): name is string => Boolean(name))
            : [];

        const selectedEntity =
            tablesInScope.length === 1
                ? tablesInScope[0]
                : findSelectedEntity(fullText, entityDefinitions);

        const attributes = getAttributesForIntellisense(
            selectedEntity,
            entityDefinitions,
            entityAttributes
        );
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
