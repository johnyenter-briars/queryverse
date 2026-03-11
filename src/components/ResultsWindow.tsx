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
import { ResultRow, Value, type EntityReference } from "../binding/model/ResultRow";
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

function renderValue(value: Value): React.ReactNode {
    if (value === null || value === undefined) return "NULL";
    if (isEntityReference(value)) {
        return value.id;
    }
    return String(value);
}

function valueToClipboardText(value: Value): string {
    if (value === null || value === undefined) return "NULL";
    if (isEntityReference(value)) {
        return value.id;
    }
    return String(value);
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
        const contextMenuRef = useRef<HTMLDivElement>(null);
        const [containerHeight, setContainerHeight] = useState<number>(800);
        const [containerWidth, setContainerWidth] = useState<number>(0);
        const [cellContextMenu, setCellContextMenu] = useState<{
            open: boolean;
            x: number;
            y: number;
            value: string;
        }>({
            open: false,
            x: 0,
            y: 0,
            value: "",
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
            if (!cellContextMenu.open) return;

            const handleClick = (event: MouseEvent) => {
                if (contextMenuRef.current?.contains(event.target as Node)) {
                    return;
                }
                setCellContextMenu((prev) => ({ ...prev, open: false }));
            };

            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.key === "Escape") {
                    setCellContextMenu((prev) => ({ ...prev, open: false }));
                }
            };

            window.addEventListener("click", handleClick, true);
            window.addEventListener("contextmenu", handleClick, true);
            window.addEventListener("keydown", handleKeyDown, true);
            return () => {
                window.removeEventListener("click", handleClick, true);
                window.removeEventListener("contextmenu", handleClick, true);
                window.removeEventListener("keydown", handleKeyDown, true);
            };
        }, [cellContextMenu.open]);

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
                        const clipboardValue = valueToClipboardText(rawValue);

                        return (
                            <TableCellLayout
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setCellContextMenu({
                                        open: true,
                                        x: event.clientX,
                                        y: event.clientY,
                                        value: clipboardValue,
                                    });
                                }}
                            >
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
                {({ renderCell }) => (
                    <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
            </DataGridRow>
        );

        const handleCopyValue = async () => {
            try {
                await navigator.clipboard.writeText(cellContextMenu.value);
                notifySuccess("Coped to clipboard");
            } catch {
                notifyError("Could not copy to clipboard.");
            } finally {
                setCellContextMenu((prev) => ({ ...prev, open: false }));
            }
        };

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
                {cellContextMenu.open ? (
                    <div
                        ref={contextMenuRef}
                        className={styles.contextMenu}
                        style={{ top: cellContextMenu.y, left: cellContextMenu.x }}
                    >
                        <button
                            type="button"
                            className={styles.contextMenuButton}
                            onClick={() => {
                                void handleCopyValue();
                            }}
                        >
                            Copy value
                        </button>
                        <button
                            type="button"
                            className={`${styles.contextMenuButton} ${styles.contextMenuButtonDisabled}`}
                            disabled
                        >
                            Copy link
                        </button>
                    </div>
                ) : null}
            </div>
        );
    }
);
