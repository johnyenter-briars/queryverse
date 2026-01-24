import { Entity } from "../binding/model/Entity";
import { EntityDefinition } from "../binding/model/EntityDefinition";

type AttributeType = "boolean" | "string" | "number" | "unknown";

const ATTRIBUTE_TYPE_ORDER: AttributeType[] = [
    "boolean",
    "string",
    "number",
    "unknown",
];

const ATTRIBUTE_TYPE_LOOKUP: Record<AttributeType, AttributeType> = {
    boolean: "boolean",
    string: "string",
    number: "number",
    unknown: "unknown",
};

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

function getAttributeType(data: Entity[], attribute: string): AttributeType {
    for (const entity of data) {
        const value = entity.attributes[attribute];
        if (value === null || value === undefined) continue;
        const valueType = typeof value;
        if (valueType === "boolean") return ATTRIBUTE_TYPE_LOOKUP.boolean;
        if (valueType === "string") return ATTRIBUTE_TYPE_LOOKUP.string;
        if (valueType === "number") return ATTRIBUTE_TYPE_LOOKUP.number;
    }
    return ATTRIBUTE_TYPE_LOOKUP.unknown;
}

export function getOrderedAttributesForResults(
    data: Entity[],
    entityDefinitions: EntityDefinition[],
    query: string
): string[] {
    if (data.length === 0) return [];

    const attributes = Object.keys(data[0].attributes);
    const primaryIdAttribute = getPrimaryIdAttributeForQuery(
        entityDefinitions,
        query
    );

    const grouped: Record<AttributeType, string[]> = {
        boolean: [],
        string: [],
        number: [],
        unknown: [],
    };

    for (const attribute of attributes) {
        if (primaryIdAttribute && attribute === primaryIdAttribute) continue;
        const attributeType = getAttributeType(data, attribute);
        grouped[attributeType].push(attribute);
    }

    const orderedAttributes: string[] = [];
    if (primaryIdAttribute && attributes.includes(primaryIdAttribute)) {
        orderedAttributes.push(primaryIdAttribute);
    }

    for (const type of ATTRIBUTE_TYPE_ORDER) {
        orderedAttributes.push(...grouped[type]);
    }

    return orderedAttributes;
}
