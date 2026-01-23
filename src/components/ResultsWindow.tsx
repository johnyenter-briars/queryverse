import * as React from "react";
import { useRef, useMemo } from "react";
import {
    DataGrid,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridBody,
    DataGridRow,
    DataGridCell,
    createTableColumn,
    TableColumnDefinition,
    webDarkTheme,
} from "@fluentui/react-components";
import { Entity, Value } from "../binding/model/Entity";

const DEFAULT_COL_WIDTH = 300;

function renderValue(value: Value): React.ReactNode {
    if (value === null || value === undefined) return "";
    return String(value);
}

export interface IResultsWindowProps {
    data: Entity[];
}

// TODO: determine the primary id via a look-ahead metadata request 
function getEntityRowId(entity: Entity): string {
    const keys = Object.keys(entity.attributes);
    if (keys.length === 0) return "empty-row";
    const primaryKey = keys.find((key) => key.endsWith("id")) ?? keys[0];
    const value = entity.attributes[primaryKey];
    return value !== null && value !== undefined
        ? String(value)
        : JSON.stringify(entity.attributes);
}

export const ResultsWindow = React.memo(({ data }: IResultsWindowProps) => {
    const dataGridScrollRef = useRef<HTMLDivElement>(null);

    const columns = useMemo<TableColumnDefinition<Entity>[]>(() => {
        if (data.length === 0) return [];

        return Object.keys(data[0].attributes).map((attribute) =>
            createTableColumn<Entity>({
                columnId: attribute,
                renderHeaderCell: () => attribute,
                renderCell: (entity) => (
                    <div style={{ whiteSpace: "nowrap" }}>
                        {renderValue(entity.attributes[attribute])}
                    </div>
                ),
            })
        );
    }, [data]);

    const totalWidth = columns.length * DEFAULT_COL_WIDTH;

    return (
        <div
            ref={dataGridScrollRef}
            style={{
                maxHeight: '100%',
                overflowY: 'auto'
            }}
        >
            <DataGrid
                items={data}
                columns={columns}
                sortable
                getRowId={
                    (entity: Entity) => getEntityRowId(entity)
                }
                style={{ minWidth: totalWidth }}
            >
                <DataGridHeader
                    style={{
                        position: "sticky",
                        top: 0,
                        background: webDarkTheme.colorNeutralBackground1,
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

                <DataGridBody>
                    {({ item, rowId }) => (
                        <DataGridRow key={rowId}>
                            {({ renderCell }) => (
                                <DataGridCell>
                                    {renderCell(item)}
                                </DataGridCell>
                            )}
                        </DataGridRow>
                    )}
                </DataGridBody>
            </DataGrid>
        </div>
    );
});
