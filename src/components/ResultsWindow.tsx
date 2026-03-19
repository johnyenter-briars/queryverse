import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    DataGridBody,
    DataGrid,
    DataGridRow,
    DataGridHeader,
    DataGridCell,
    DataGridHeaderCell,
    type RowRenderer,
} from "@fluentui-contrib/react-data-grid-react-window";
import {
    createTableColumn,
    type TableColumnDefinition,
    type TableColumnSizingOptions,
    Spinner,
    webDarkTheme,
    useFluent,
    useScrollbarWidth,
    TableCellLayout,
} from "@fluentui/react-components";
import {
    ResultRow,
    Value,
    type EntityReference,
    type MoneyValue,
    type OptionSetValue,
    type OptionSetValueCollection,
} from "../binding/model/ResultRow";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { SqlQueryMetadata } from "../binding/model/SqlQueryMetadata";
import {
    buildResultColumnDescriptors,
    getPrimaryIdAttributeForQuery,
} from "../utility/resultsColumns";
import { useResultsWindowStyles } from "../styles/ResultsWindowStyles";
import { useAppToast } from "../utility/toast";

const DEFAULT_COL_WIDTH = 300;
const MIN_COL_WIDTH = 120;
const ROW_NUMBER_COL_WIDTH = 40;
const ROW_NUMBER_MIN_WIDTH = 40;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const AUTO_FIT_COLUMNS = false;

function isEntityReference(value: Value): value is EntityReference {
    return (
        value !== null &&
        typeof value === "object" &&
        "id" in value &&
        "logical_name" in value
    );
}

function isMoneyValue(value: Value): value is MoneyValue {
    return value !== null && typeof value === "object" && "value" in value;
}

function isOptionSetValue(value: Value): value is OptionSetValue {
    return (
        value !== null &&
        typeof value === "object" &&
        "value" in value &&
        typeof value.value === "number"
    );
}

function isOptionSetValueCollection(value: Value): value is OptionSetValueCollection {
    return (
        value !== null &&
        typeof value === "object" &&
        "values" in value &&
        Array.isArray(value.values)
    );
}

function formatValue(value: Value): string {
    if (value === null || value === undefined) return "NULL";
    if (isEntityReference(value)) {
        return value.name?.trim() || value.id;
    }
    if (isOptionSetValueCollection(value)) {
        return value.values.join(", ");
    }
    if (isOptionSetValue(value) || isMoneyValue(value)) {
        return String(value.value);
    }
    return String(value);
}

function renderValue(value: Value): React.ReactNode {
    return formatValue(value);
}

function valueToClipboardText(value: Value): string {
    return formatValue(value);
}

export interface IResultsWindowProps {
    data: ResultRow[];
    entityDefinitions: EntityDefinition[];
    query: string;
    queryMetadata?: SqlQueryMetadata | null;
    isLoading: boolean;
    errorMessage?: string | null;
}

function getRowId(row: ResultRow, primaryIdAttribute?: string): string {
    const keys = Object.keys(row.attributes);
    if (keys.length === 0) return "empty-row";
    const primaryKey =
        (primaryIdAttribute && keys.includes(primaryIdAttribute)
            ? primaryIdAttribute
            : undefined) ??
        keys.find((key) => key.endsWith("id")) ??
        keys[0];
    const value = row.attributes[primaryKey];
    if (value === null || value === undefined) {
        return JSON.stringify(row.attributes);
    }
    if (isEntityReference(value)) {
        return value.id;
    }
    if (isOptionSetValueCollection(value)) {
        return value.values.join(",");
    }
    if (isOptionSetValue(value) || isMoneyValue(value)) {
        return String(value.value);
    }
    return String(value);
}

export const ResultsWindow = React.memo(
    ({
        data,
        entityDefinitions,
        query,
        queryMetadata,
        isLoading,
        errorMessage,
    }: IResultsWindowProps) => {
        const { targetDocument } = useFluent();
        const scrollbarWidth = useScrollbarWidth({ targetDocument }) ?? 0;
        const styles = useResultsWindowStyles();
        const { notifySuccess, notifyError } = useAppToast();

        const containerRef = useRef<HTMLDivElement>(null);
        const [containerHeight, setContainerHeight] = useState<number>(800);
        const [containerWidth, setContainerWidth] = useState<number>(0);

        useEffect(() => {
            const el = containerRef.current;
            if (!el) return;

            const updateHeight = () => {
                setContainerHeight(el.clientHeight);
                setContainerWidth(el.clientWidth);
            };

            updateHeight();

            const observer = new ResizeObserver(() => {
                updateHeight();
            });
            observer.observe(el);

            return () => {
                observer.disconnect();
            };
        }, []);

        const orderedAttributes = useMemo(() => {
            if (data.length === 0) return [];
            return buildResultColumnDescriptors(data, entityDefinitions, query, queryMetadata);
        }, [data, entityDefinitions, query, queryMetadata]);

        const columns = useMemo<TableColumnDefinition<ResultRow>[]>(() => {
            return orderedAttributes.map(({ key, attribute, dataKey }) =>
                createTableColumn<ResultRow>({
                    columnId: key,
                    renderHeaderCell: () => (
                        <span className={styles.headerContent}>{attribute}</span>
                    ),
                    renderCell: (row) => {
                        const rawValue = row.attributes[dataKey];

                        return (
                            <TableCellLayout>
                                <span className={styles.cellContent}>
                                    {renderValue(rawValue)}
                                </span>
                            </TableCellLayout>
                        );
                    },
                })
            );
        }, [orderedAttributes, styles.cellContent, styles.headerContent]);

        const columnSizingOptions = useMemo<TableColumnSizingOptions>(() => {
            const options: TableColumnSizingOptions = {};
            for (const { key, dataKey } of orderedAttributes) {
                const isRowNumber = dataKey === "__rownum";
                options[key] = {
                    defaultWidth: isRowNumber ? ROW_NUMBER_COL_WIDTH : DEFAULT_COL_WIDTH,
                    minWidth: isRowNumber ? ROW_NUMBER_MIN_WIDTH : MIN_COL_WIDTH,
                    idealWidth: isRowNumber ? ROW_NUMBER_COL_WIDTH : DEFAULT_COL_WIDTH,
                };
            }
            return options;
        }, [orderedAttributes]);

        const primaryIdAttribute = useMemo(
            () => getPrimaryIdAttributeForQuery(entityDefinitions, query),
            [entityDefinitions, query]
        );

        const totalWidth = columns.length * DEFAULT_COL_WIDTH;
        const bodyHeight = Math.max(200, containerHeight - HEADER_HEIGHT);
        const bodyWidth = containerWidth > 0 ? containerWidth : "100%";

        const innerElementType = useMemo(() => {
            return React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
                (props, ref) => {
                    const { style, ...rest } = props;
                    return (
                        <div
                            ref={ref}
                            {...rest}
                            style={{
                                ...style,
                                width: totalWidth,
                            }}
                        />
                    );
                }
            );
        }, [totalWidth]);

        if (isLoading) {
            return (
                <div
                    style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Spinner label="Running query..." />
                </div>
            );
        }

        if (errorMessage) {
            return (
                <div
                    style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                    }}
                >
                    {errorMessage}
                </div>
            );
        }

        const renderRow: RowRenderer<ResultRow> = ({ item, rowId }, style) => (
            <DataGridRow<ResultRow> key={rowId} style={style}>
                {({ renderCell, columnId }) => {
                    const column = orderedAttributes.find((entry) => entry.key === columnId);
                    const cellValue = column
                        ? valueToClipboardText(item.attributes[column.dataKey])
                        : "";

                    return (
                        <DataGridCell
                            onDoubleClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(cellValue);
                                    notifySuccess("Coped to clipboard");
                                } catch {
                                    notifyError("Could not copy to clipboard.");
                                }
                            }}
                        >
                            {renderCell(item)}
                        </DataGridCell>
                    );
                }}
            </DataGridRow>
        );

        return (
            <div
                ref={containerRef}
                className={styles.root}
                style={{
                    height: "100%",
                    width: "100%",
                    maxWidth: "100%",
                    overflow: "hidden",
                }}
            >
                <DataGrid
                    items={data}
                    columns={columns}
                    focusMode="cell"
                    sortable
                    resizableColumns
                    resizableColumnsOptions={{ autoFitColumns: AUTO_FIT_COLUMNS }}
                    columnSizingOptions={columnSizingOptions}
                    style={{ minWidth: "auto", width: "100%" }}
                    getRowId={(row: ResultRow) =>
                        getRowId(row, primaryIdAttribute)
                    }
                >
                    <DataGridHeader
                        style={{
                            position: "sticky",
                            top: 0,
                            background: webDarkTheme.colorNeutralBackground1,
                            paddingRight: scrollbarWidth,
                            zIndex: 10,
                        }}
                    >
                        <DataGridRow>
                            {({ renderHeaderCell }) => (
                                <DataGridHeaderCell>
                                    {renderHeaderCell()}
                                </DataGridHeaderCell>
                            )}
                        </DataGridRow>
                    </DataGridHeader>

                    <DataGridBody<ResultRow>
                        itemSize={ROW_HEIGHT}
                        height={bodyHeight}
                        width={bodyWidth}
                        listProps={{ innerElementType }}
                    >
                        {renderRow}
                    </DataGridBody>
                </DataGrid>
            </div>
        );
    }
);
