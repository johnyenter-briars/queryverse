import type { ResultRow, Value } from "../binding/model/ResultRow";

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
