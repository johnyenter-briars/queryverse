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
    type TableColumnId,
    type TableColumnSizingOptions,
    type SortDirection,
    Button,
    Spinner,
    webDarkTheme,
    useFluent,
    useScrollbarWidth,
    TableCellLayout,
} from "@fluentui/react-components";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
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
import { exportCsv, exportExcel } from "../binding/function";

const DEFAULT_COL_WIDTH = 300;
const MIN_COL_WIDTH = 120;
const ROW_NUMBER_MIN_WIDTH = 40;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const AUTO_FIT_COLUMNS = false;
const CELL_HORIZONTAL_PADDING = 32;
const CELL_MEASURE_FONT = "14px 'Segoe UI'";
const MAX_COL_WIDTH = 1600;
const MAX_WIDTH_SAMPLE_ROWS = 200;

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
        return value.id;
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

function getSortableValue(value: Value): number | string | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    if (typeof value === "string") {
        return value;
    }

    if (isEntityReference(value)) {
        return formatValue(value);
    }

    if (isOptionSetValueCollection(value)) {
        return value.values.join(", ");
    }

    if (isOptionSetValue(value)) {
        return value.value;
    }

    if (isMoneyValue(value)) {
        if (typeof value.value === "number") {
            return value.value;
        }

        const parsed = Number(value.value);
        return Number.isNaN(parsed) ? String(value.value) : parsed;
    }

    return String(value);
}

function compareCellValues(left: Value, right: Value): number {
    const leftValue = getSortableValue(left);
    const rightValue = getSortableValue(right);

    if (leftValue === null && rightValue === null) {
        return 0;
    }

    if (leftValue === null) {
        return 1;
    }

    if (rightValue === null) {
        return -1;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
        return leftValue - rightValue;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

function measureTextWidth(
    text: string,
    targetDocument?: Document | null,
    measureContext?: CanvasRenderingContext2D | null
): number {
    if (measureContext) {
        return measureContext.measureText(text).width;
    }

    if (!targetDocument) {
        return text.length * 8;
    }

    const canvas = targetDocument.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        return text.length * 8;
    }

    context.font = CELL_MEASURE_FONT;
    return context.measureText(text).width;
}

function buildEntityReferenceRecordUrl(
    value: EntityReference,
    dataverseUrl?: string | null
): string {
    if (!dataverseUrl) {
        return value.id;
    }

    const trimmedBaseUrl = dataverseUrl.replace(/\/+$/, "");
    return `${trimmedBaseUrl}/main.aspx?pagetype=entityrecord&etn=${encodeURIComponent(
        value.logical_name
    )}&id=${encodeURIComponent(value.id)}`;
}

function valueToClipboardText(value: Value, dataverseUrl?: string | null): string {
    if (isEntityReference(value)) {
        return buildEntityReferenceRecordUrl(value, dataverseUrl);
    }

    return formatValue(value);
}

export interface IResultsWindowProps {
    data: ResultRow[];
    entityDefinitions: EntityDefinition[];
    query: string;
    queryMetadata?: SqlQueryMetadata | null;
    isLoading: boolean;
    loadingMessage?: string;
    layout?: "grid" | "details";
    errorMessage?: string | null;
    dataverseUrl?: string | null;
    exportJobId?: string | null;
    stretchToContainer?: boolean;
    onPreferredWidthChange?: (width: number) => void;
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

type ResultDetailsCardProps = {
    data: ResultRow[];
    styles: ReturnType<typeof useResultsWindowStyles>;
};

function ResultDetailsCard({ data, styles }: ResultDetailsCardProps) {
    if (data.length === 0) {
        return null;
    }

    const detailEntries = Object.entries(data[0].attributes);

    return (
        <div className={styles.progressCardShell}>
            <div className={styles.progressCard}>
                <div className={styles.detailsList}>
                    {detailEntries.map(([key, value]) => (
                        <div
                            key={key}
                            className={
                                key === detailEntries[detailEntries.length - 1][0]
                                    ? `${styles.detailsRow} ${styles.detailsRowLast}`
                                    : styles.detailsRow
                            }
                        >
                            <div className={styles.detailsKey}>{key}</div>
                            <div className={styles.detailsValue}>{renderValue(value)}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export const ResultsWindow = React.memo(
    ({
        data,
        entityDefinitions,
        query,
        queryMetadata,
        isLoading,
        layout = "grid",
        errorMessage,
        dataverseUrl,
        exportJobId,
        stretchToContainer = true,
        onPreferredWidthChange,
    }: IResultsWindowProps) => {
        const { targetDocument } = useFluent();
        const scrollbarWidth = useScrollbarWidth({ targetDocument }) ?? 0;
        const styles = useResultsWindowStyles();
        const { notifySuccess, notifyError, notifyWarning } = useAppToast();

        const containerRef = useRef<HTMLDivElement>(null);
        const exportMenuRef = useRef<HTMLDivElement>(null);
        const [containerHeight, setContainerHeight] = useState<number>(800);
        const [containerWidth, setContainerWidth] = useState<number>(0);
        const [exportMenu, setExportMenu] = useState<{
            open: boolean;
            x: number;
            y: number;
        }>({ open: false, x: 0, y: 0 });
        const [sortState, setSortState] = useState<{
            sortColumn: TableColumnId | undefined;
            sortDirection: SortDirection;
        }>({
            sortColumn: undefined,
            sortDirection: "ascending",
        });

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

        useEffect(() => {
            if (!exportMenu.open) return;

            const handleClose = (event: MouseEvent | KeyboardEvent) => {
                if (
                    event instanceof MouseEvent &&
                    exportMenuRef.current?.contains(event.target as Node)
                ) {
                    return;
                }

                setExportMenu({ open: false, x: 0, y: 0 });
            };

            window.addEventListener("click", handleClose, true);
            window.addEventListener("contextmenu", handleClose, true);
            window.addEventListener("keydown", handleClose, true);

            return () => {
                window.removeEventListener("click", handleClose, true);
                window.removeEventListener("contextmenu", handleClose, true);
                window.removeEventListener("keydown", handleClose, true);
            };
        }, [exportMenu.open]);

        const orderedAttributes = useMemo(() => {
            if (data.length === 0) return [];
            return buildResultColumnDescriptors(data, entityDefinitions, query, queryMetadata);
        }, [data, entityDefinitions, query, queryMetadata]);

        useEffect(() => {
            if (
                sortState.sortColumn &&
                !orderedAttributes.some((entry) => entry.key === sortState.sortColumn)
            ) {
                setSortState({
                    sortColumn: undefined,
                    sortDirection: "ascending",
                });
            }
        }, [orderedAttributes, sortState.sortColumn]);

        const columns = useMemo<TableColumnDefinition<ResultRow>[]>(() => {
            return orderedAttributes.map(({ key, attribute, dataKey }) =>
                createTableColumn<ResultRow>({
                    columnId: key,
                    compare: (left, right) =>
                        compareCellValues(left.attributes[dataKey], right.attributes[dataKey]),
                    renderHeaderCell: () =>
                        dataKey === "__rownum" && !isLoading ? (
                            <Button
                                appearance="subtle"
                                size="small"
                                icon={<ArrowDownload24Regular />}
                                className={styles.resultsHeaderActionButton}
                                onClick={openExportMenu}
                                onContextMenu={openExportMenu}
                                title="Export results"
                            />
                        ) : dataKey === "__rownum" ? null : (
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
        }, [
            isLoading,
            openExportMenu,
            orderedAttributes,
            styles.cellContent,
            styles.headerContent,
            styles.resultsHeaderActionButton,
        ]);

        const sortedData = useMemo(() => {
            if (!sortState.sortColumn) {
                return data;
            }

            const column = orderedAttributes.find((entry) => entry.key === sortState.sortColumn);
            if (!column) {
                return data;
            }

            const directionMultiplier = sortState.sortDirection === "ascending" ? 1 : -1;

            return [...data].sort((left, right) => {
                return (
                    compareCellValues(
                        left.attributes[column.dataKey],
                        right.attributes[column.dataKey]
                    ) * directionMultiplier
                );
            });
        }, [data, orderedAttributes, sortState]);

        const computedColumnWidths = useMemo(() => {
            const sampledRows =
                data.length > MAX_WIDTH_SAMPLE_ROWS
                    ? data.slice(0, MAX_WIDTH_SAMPLE_ROWS)
                    : data;
            const canvas = targetDocument?.createElement("canvas");
            const measureContext = canvas?.getContext("2d");
            if (measureContext) {
                measureContext.font = CELL_MEASURE_FONT;
            }

            const largestRowNumberWidth =
                measureTextWidth(String(Math.max(data.length, 1)), targetDocument, measureContext) +
                CELL_HORIZONTAL_PADDING;

            return orderedAttributes.reduce<Record<string, number>>((widths, entry) => {
                const isRowNumber = entry.dataKey === "__rownum";

                if (isRowNumber) {
                    widths[entry.key] = Math.max(ROW_NUMBER_MIN_WIDTH, largestRowNumberWidth);
                    return widths;
                }

                const headerWidth =
                    measureTextWidth(entry.attribute, targetDocument, measureContext) +
                    CELL_HORIZONTAL_PADDING;

                const valueWidth = sampledRows.reduce((maxWidth, row) => {
                    const displayValue = formatValue(row.attributes[entry.dataKey]);
                    const nextWidth =
                        measureTextWidth(displayValue, targetDocument, measureContext) +
                        CELL_HORIZONTAL_PADDING;
                    return Math.max(maxWidth, nextWidth);
                }, 0);

                widths[entry.key] = Math.min(
                    MAX_COL_WIDTH,
                    Math.max(MIN_COL_WIDTH, headerWidth, valueWidth)
                );
                return widths;
            }, {});
        }, [data, orderedAttributes, targetDocument]);

        const columnSizingOptions = useMemo<TableColumnSizingOptions>(() => {
            const options: TableColumnSizingOptions = {};
            for (const { key, dataKey } of orderedAttributes) {
                const isRowNumber = dataKey === "__rownum";
                const width = computedColumnWidths[key] ?? DEFAULT_COL_WIDTH;
                options[key] = {
                    defaultWidth: width,
                    minWidth: isRowNumber ? ROW_NUMBER_MIN_WIDTH : MIN_COL_WIDTH,
                    idealWidth: width,
                };
            }
            return options;
        }, [computedColumnWidths, orderedAttributes]);

        const primaryIdAttribute = useMemo(
            () => getPrimaryIdAttributeForQuery(entityDefinitions, query),
            [entityDefinitions, query]
        );

        const totalWidth = useMemo(
            () =>
                orderedAttributes.reduce((sum, { key }) => {
                    return sum + (computedColumnWidths[key] ?? DEFAULT_COL_WIDTH);
                }, 0),
            [computedColumnWidths, orderedAttributes]
        );

        useEffect(() => {
            if (totalWidth > 0) {
                onPreferredWidthChange?.(totalWidth);
            }
        }, [onPreferredWidthChange, totalWidth]);
        const bodyHeight = Math.max(200, containerHeight - HEADER_HEIGHT);
        const bodyWidth = containerWidth > 0 ? containerWidth : "100%";

        function openExportMenu(event: React.MouseEvent<HTMLElement>) {
            event.preventDefault();
            event.stopPropagation();
            setExportMenu({
                open: true,
                x: event.clientX,
                y: event.clientY,
            });
        }

        const handleExportCsv = async () => {
            setExportMenu({ open: false, x: 0, y: 0 });

            if (!exportJobId) {
                notifyWarning("No exportable result set is available.");
                return;
            }

            try {
                const savedPath = await exportCsv(exportJobId);
                if (savedPath) {
                    notifySuccess(`CSV exported: ${savedPath}`);
                }
            } catch (error) {
                notifyError(error instanceof Error ? error.message : "Could not export CSV.");
            }
        };

        const handleExportExcel = async () => {
            setExportMenu({ open: false, x: 0, y: 0 });

            if (!exportJobId) {
                notifyWarning("No exportable result set is available.");
                return;
            }

            try {
                const savedPath = await exportExcel(exportJobId);
                if (savedPath) {
                    notifySuccess(`Excel exported: ${savedPath}`);
                }
            } catch (error) {
                notifyError(error instanceof Error ? error.message : "Could not export Excel.");
            }
        };

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
                        ? valueToClipboardText(
                              item.attributes[column.dataKey],
                              dataverseUrl
                          )
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

        if (layout === "details" && data.length > 0) {
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
                    {isLoading ? (
                        <div className={styles.loadingOverlay}>
                            <div className={styles.loadingCard}>
                                <Spinner />
                            </div>
                        </div>
                    ) : null}
                    <ResultDetailsCard data={data} styles={styles} />
                </div>
            );
        }

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
                {exportMenu.open ? (
                        <div
                            ref={exportMenuRef}
                            className={styles.resultsContextMenu}
                            style={{ left: exportMenu.x, top: exportMenu.y }}
                        >
                            <Button
                                appearance="subtle"
                                className={styles.resultsContextMenuButton}
                                onClick={() => void handleExportCsv()}
                            >
                                CSV
                            </Button>
                            <Button
                                appearance="subtle"
                                className={styles.resultsContextMenuButton}
                                onClick={() => void handleExportExcel()}
                            >
                                Excel
                            </Button>
                            <Button appearance="subtle" className={styles.resultsContextMenuButton}>
                                JSON (TODO)
                            </Button>
                    </div>
                ) : null}
                {isLoading ? (
                    <div className={styles.loadingOverlay}>
                        <div className={styles.loadingCard}>
                            <Spinner />
                        </div>
                    </div>
                ) : null}
                <DataGrid
                    items={sortedData}
                    columns={columns}
                    focusMode="cell"
                    sortable
                    sortState={sortState}
                    onSortChange={(_, nextSortState) => setSortState(nextSortState)}
                    resizableColumns
                    resizableColumnsOptions={{ autoFitColumns: AUTO_FIT_COLUMNS }}
                    columnSizingOptions={columnSizingOptions}
                    style={{
                        minWidth: "auto",
                        width: stretchToContainer ? "100%" : `${Math.max(totalWidth, 1)}px`,
                    }}
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
