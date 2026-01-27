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
import { Entity, Value } from "../binding/model/Entity";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { SqlQueryMetadata } from "../binding/model/SqlQueryMetadata";
import {
    buildResultColumnDescriptors,
    getPrimaryIdAttributeForQuery,
} from "../utility/resultsColumns";

const DEFAULT_COL_WIDTH = 300;
const MIN_COL_WIDTH = 120;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const AUTO_FIT_COLUMNS = false;

function renderValue(value: Value): React.ReactNode {
    if (value === null || value === undefined) return "";
    return String(value);
}

export interface IResultsWindowProps {
    data: Entity[];
    entityDefinitions: EntityDefinition[];
    query: string;
    queryMetadata?: SqlQueryMetadata | null;
    isLoading: boolean;
    errorMessage?: string | null;
}

function getEntityRowId(entity: Entity, primaryIdAttribute?: string): string {
    const keys = Object.keys(entity.attributes);
    if (keys.length === 0) return "empty-row";
    const primaryKey =
        (primaryIdAttribute && keys.includes(primaryIdAttribute)
            ? primaryIdAttribute
            : undefined) ??
        keys.find((key) => key.endsWith("id")) ??
        keys[0];
    const value = entity.attributes[primaryKey];
    return value !== null && value !== undefined
        ? String(value)
        : JSON.stringify(entity.attributes);
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

        const containerRef = useRef<HTMLDivElement>(null);
        const [containerHeight, setContainerHeight] = useState<number>(800);

        useEffect(() => {
            const el = containerRef.current;
            if (!el) return;

            const updateHeight = () => {
                setContainerHeight(el.clientHeight);
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

        const columns = useMemo<TableColumnDefinition<Entity>[]>(() => {
            return orderedAttributes.map(({ key, attribute, dataKey }) =>
                createTableColumn<Entity>({
                    columnId: key,
                    renderHeaderCell: () => attribute,
                    renderCell: (entity) => (
                        <TableCellLayout>
                                {renderValue(entity.attributes[dataKey])}
                        </TableCellLayout>
                    ),
                })
            );
        }, [orderedAttributes]);

        const columnSizingOptions = useMemo<TableColumnSizingOptions>(() => {
            const options: TableColumnSizingOptions = {};
            for (const { key } of orderedAttributes) {
                options[key] = {
                    defaultWidth: DEFAULT_COL_WIDTH,
                    minWidth: MIN_COL_WIDTH,
                    idealWidth: DEFAULT_COL_WIDTH,
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

        const renderRow: RowRenderer<Entity> = ({ item, rowId }, style) => (
            <DataGridRow<Entity> key={rowId} style={style}>
                {({ renderCell }) => (
                    <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
            </DataGridRow>
        );

        return (
            <div
                ref={containerRef}
                style={{
                    height: "100%",
                    width: "100%",
                    maxWidth: "100%",
                    overflow: "auto",
                }}
            >
                <div style={{ minWidth: totalWidth, width: "fit-content" }}>
                    <DataGrid
                        items={data}
                        columns={columns}
                        focusMode="cell"
                        sortable
                        resizableColumns
                        resizableColumnsOptions={{ autoFitColumns: AUTO_FIT_COLUMNS }}
                        columnSizingOptions={columnSizingOptions}
                        style={{ minWidth: "auto" }}
                        getRowId={(entity: Entity) =>
                            getEntityRowId(entity, primaryIdAttribute)
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

                        <DataGridBody<Entity> itemSize={ROW_HEIGHT} height={bodyHeight}>
                            {renderRow}
                        </DataGridBody>
                    </DataGrid>
                </div>
            </div>
        );
    }
);
