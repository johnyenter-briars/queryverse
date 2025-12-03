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

export const ResultsWindow = React.memo(() => {
    const dataGridScrollRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);

    const onBottomScroll = React.useCallback(() => {
        if (dataGridScrollRef.current && topScrollRef.current) {
            topScrollRef.current.scrollLeft = dataGridScrollRef.current.scrollLeft;
        }
    }, []);

    return (
        <div 
            className="flex flex-col h-full w-full p-4 bg-gray-900 rounded-xl shadow-2xl"
            style={{ 
                maxHeight: "100%", 
                minHeight: 0,
                backgroundColor: webDarkTheme.colorNeutralBackground1, 
                color: webDarkTheme.colorNeutralForeground1, 
            }}
        >
            <div
                ref={dataGridScrollRef}
                onScroll={onBottomScroll}
                className="flex-1 overflow-auto" 
                style={{
                    position: 'relative',
                }}
            >
                <DataGrid
                    items={mockData}
                    columns={mockColumns}
                    sortable
                    getRowId={(item) => item.col1}
                    style={{ minWidth: MIN_CONTENT_WIDTH }}
                >
                    <DataGridHeader
                        style={{
                            position: "sticky",
                            top: 0,
                            background: webDarkTheme.colorNeutralBackground1,
                            zIndex: 10,
                            boxShadow: `0 2px 4px rgba(0, 0, 0, 0.4)`, 
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
        </div>
    );
});