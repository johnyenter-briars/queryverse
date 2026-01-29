import { EntityDefinition } from "../binding/model/EntityDefinition";

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
