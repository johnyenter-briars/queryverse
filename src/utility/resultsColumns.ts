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

export function getOrderedAttributesForResults(
    data: Entity[],
    entityDefinitions: EntityDefinition[],
    query: string,
    queryMetadata?: SqlQueryMetadata | null
): { key: string; attribute: string }[] {
    if (data.length === 0) return [];

    const attributes = Object.keys(data[0].attributes);
    const buildOrderedColumns = (orderedAttributes: string[]) => {
        const usedKeys = new Set<string>();
        const counts = new Map<string, number>();

        return orderedAttributes.map((attribute) => {
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
            return { key, attribute };
        });
    };

    if (queryMetadata?.columnsOrder?.length) {
        const ordered = queryMetadata.columnsOrder.filter((attribute) =>
            attributes.includes(attribute)
        );
        return buildOrderedColumns(ordered);
    }
    const primaryIdAttribute = getPrimaryIdAttributeForQuery(
        entityDefinitions,
        query
    );
    const sorted = attributes.slice().sort((a, b) => a.localeCompare(b));
    if (primaryIdAttribute && sorted.includes(primaryIdAttribute)) {
        return buildOrderedColumns([
            primaryIdAttribute,
            ...sorted.filter((attribute) => attribute !== primaryIdAttribute),
        ]);
    }
    return buildOrderedColumns(sorted);
}
