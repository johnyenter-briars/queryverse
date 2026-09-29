import type { EntityReference, ResultRow, Value } from "../binding/model/ResultRow";
import type { EntityDefinition } from "../binding/model/EntityDefinition";

type ResultColumn = {
    attribute: string;
    dataKey: string;
};

export function formatResultValue(value: Value | undefined): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value !== "object") return String(value);
    if ("id" in value && "logical_name" in value) return value.id;
    if ("values" in value && Array.isArray(value.values)) {
        return value.values.join(", ");
    }
    if ("value" in value) return String(value.value);
    return String(value);
}

export function buildEntityReferenceRecordUrl(
    value: EntityReference,
    dataverseUrl: string
): string {
    const baseUrl = dataverseUrl.replace(/\/+$/, "");
    return `${baseUrl}/main.aspx?pagetype=entityrecord&etn=${encodeURIComponent(
        value.logical_name
    )}&id=${encodeURIComponent(value.id)}`;
}

export function primaryIdToRecordReference(
    value: Value | undefined,
    columnKey: string | undefined,
    entity: EntityDefinition | undefined
): EntityReference | null {
    if (
        !entity?.PrimaryIdAttribute ||
        !columnKey ||
        columnKey.toLowerCase() !== entity.PrimaryIdAttribute.toLowerCase() ||
        typeof value !== "string"
    ) {
        return null;
    }

    const id = value.trim();
    if (id.startsWith("{") !== id.endsWith("}")) {
        return null;
    }
    const bareId = id.startsWith("{") ? id.slice(1, -1) : id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bareId)) {
        return null;
    }
    return { id, logical_name: entity.LogicalName };
}

function escapeTabularCell(value: string): string {
    return /[\t\r\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildResultsClipboardText(rows: ResultRow[], columns: ResultColumn[]): string {
    const visibleColumns = columns.filter((column) => column.dataKey !== "__rownum");
    if (visibleColumns.length === 0) return "";

    const header = visibleColumns.map((column) => escapeTabularCell(column.attribute)).join("\t");
    const body = rows.map((row) =>
        visibleColumns
            .map((column) => escapeTabularCell(formatResultValue(row.attributes[column.dataKey])))
            .join("\t")
    );

    return [header, ...body].join("\r\n");
}
