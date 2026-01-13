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
import { Attribute, Entity, Value } from "../binding/model/Entity";


function renderValue(value: Value): React.ReactNode {
    if (value === null) return "";
    return String(value);
}


type Item = Record<string, string | number>;

const COLUMN_COUNT = 30;
const ROW_COUNT = 100;
const COLUMN_WIDTH_PX = 150;

const mockColumns: TableColumnDefinition<Item>[] = Array.from({ length: COLUMN_COUNT }).map((_, i) =>
    createTableColumn<Item>({
        columnId: `col${i + 1}`,
        renderHeaderCell: () => `Field ${i + 1}`,
        renderCell: (item) => item[`col${i + 1}`],
    })
);

const mockData: Item[] = Array.from({ length: ROW_COUNT }).map((_, i) => {
    const row: Item = {};
    for (let c = 0; c < COLUMN_COUNT; c++) {
        row[`col${c + 1}`] = `Row ${i + 1}, Col ${c + 1}`;
    }
    return row;
});

const MIN_CONTENT_WIDTH = `${COLUMN_COUNT * COLUMN_WIDTH_PX}px`;

export interface IResultsWindowProps {
    data: Entity[],
}

export const ResultsWindow = React.memo(({
    data,
}: IResultsWindowProps) => {
    const dataGridScrollRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);

    const onBottomScroll = React.useCallback(() => {
        if (dataGridScrollRef.current && topScrollRef.current) {
            topScrollRef.current.scrollLeft = dataGridScrollRef.current.scrollLeft;
        }
    }, []);

    // const columns: TableColumnDefinition<Entity>[] = Array.from({ length: data[0]?.attributes?.length ?? 0 }).map((_, i) =>
    //     createTableColumn<Item>({
    //         columnId: `col${i + 1}`,
    //         renderHeaderCell: () => `Field ${i + 1}`,
    //         renderCell: (item) => item[`col${i + 1}`],
    //     })
    // );

    const columns: TableColumnDefinition<Entity>[] = data.length === 0 ?
        [] :
        Object.keys(data[0].attributes).map((attribute) =>
            createTableColumn<Entity>({
                columnId: `col${attribute}`,
                renderHeaderCell: () => attribute,
                renderCell: (record) => record.attributes[attribute],
            })
        );

    return (
        <div
            ref={dataGridScrollRef}
            onScroll={onBottomScroll}
            style={{
                maxHeight: '100%',
                overflowY: 'auto'
            }}
        >
            <DataGrid
                items={data}
                columns={columns}
                sortable
                getRowId={(item: Entity) => item.attributes['accountid']?.toString() ?? ""}
                style={{ minWidth: MIN_CONTENT_WIDTH }}
            >
                <DataGridHeader
                    style={{
                        position: "sticky",
                        top: 0,
                        background: webDarkTheme.colorNeutralBackground1,
                        backgroundColor: webDarkTheme.colorNeutralBackground1,
                        zIndex: 10,
                    }}
                >
                    <DataGridRow>
                        {({ renderHeaderCell }) => (
                            <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                        )}
                    </DataGridRow>
                </DataGridHeader>

                <DataGridBody>
                    {({ item, rowId }) => (
                        <DataGridRow key={rowId}>
                            {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                        </DataGridRow>
                    )}
                </DataGridBody>
            </DataGrid>
        </div>
    );
});
