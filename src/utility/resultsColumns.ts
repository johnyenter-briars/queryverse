import { Entity } from "../binding/model/Entity";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { SqlQueryMetadata } from "../binding/model/SqlQueryMetadata";

function normalizeEntityName(name: string): string {
    const cleaned = name.replace(/[\[\]"`]/g, "").trim();
    const parts = cleaned.split(".");
    return parts[parts.length - 1] ?? cleaned;
}

function extractEntityNameFromQuery(query: string): string | null {
    const match = query.match(/\bfrom\s+([^\s;]+)/i);
    if (!match) return null;
    const raw = match[1].replace(/,$/, "");
    return normalizeEntityName(raw);
}

export function getEntityDefinitionForQuery(
    entityDefinitions: EntityDefinition[],
    query: string
): EntityDefinition | undefined {
    const entityName = extractEntityNameFromQuery(query);
    if (!entityName) return undefined;
    const target = entityName.toLowerCase();
    return entityDefinitions.find((definition) =>
        [definition.LogicalName, definition.EntitySetName, definition.SchemaName]
            .filter(Boolean)
            .some((value) => value.toLowerCase() === target)
    );
}

export function getPrimaryIdAttributeForQuery(
    entityDefinitions: EntityDefinition[],
    query: string
): string | undefined {
    return getEntityDefinitionForQuery(entityDefinitions, query)
        ?.PrimaryIdAttribute;
}

/**
 * Builds ordered column descriptors for the results grid, honoring select order,
 * resolving lookup attributes to their underlying _<name>_value keys, and
 * generating unique column IDs for duplicates.
 */
export function buildResultColumnDescriptors(
    data: Entity[],
    entityDefinitions: EntityDefinition[],
    query: string,
    queryMetadata?: SqlQueryMetadata | null
): { key: string; attribute: string; dataKey: string }[] {
    if (data.length === 0) return [];

    const attributes = Object.keys(data[0].attributes);

    if (queryMetadata?.columnsOrder?.length) {
        const ordered = queryMetadata.columnsOrder
            .map((attribute) => {
                // Respect select list order but only include attributes present in results.
                const dataKey = resolveAttributeKey(attributes, attribute);
                return dataKey ? { attribute, dataKey } : undefined;
            })
            .filter(
                (column): column is { attribute: string; dataKey: string } =>
                    Boolean(column)
            );
        return buildOrderedColumns(ordered);
    }

    const primaryIdAttribute = getPrimaryIdAttributeForQuery(
        entityDefinitions,
        query
    );

    const sorted = attributes.slice().sort((a, b) => a.localeCompare(b));

    if (primaryIdAttribute && sorted.includes(primaryIdAttribute)) {
        // No select list: prefer primary ID first, then the remaining attributes.
        return buildOrderedColumns(
            [
                primaryIdAttribute,
                ...sorted.filter((attribute) => attribute !== primaryIdAttribute),
            ].map((attribute) => ({ attribute, dataKey: attribute }))
        );
    }

    return buildOrderedColumns(
        sorted.map((attribute) => ({ attribute, dataKey: attribute }))
    );
}

const resolveAttributeKey = (attributes: string[], attribute: string): string | undefined => {
    // Prefer the explicit attribute, but fall back to lookup storage keys.
    if (attributes.includes(attribute)) return attribute;

    const lookupKey = `_${attribute}_value`;

    if (attributes.includes(lookupKey)) return lookupKey;

    return undefined;
};

const buildOrderedColumns = (
    orderedAttributes: { attribute: string; dataKey: string }[]
) => {
    const usedKeys = new Set<string>();
    const counts = new Map<string, number>();

    return orderedAttributes.map(({ attribute, dataKey }) => {
        // Ensure column IDs are unique even when attributes are selected twice.
        let key = attribute;
        let count = counts.get(attribute) ?? 0;

        if (usedKeys.has(key)) {
            do {
                count += 1;
                key = `${attribute}__${count}`;
            } while (usedKeys.has(key));
        } else {
            count = 1;
        }

        counts.set(attribute, count);
        usedKeys.add(key);
        return { key, attribute, dataKey };
    });
};
