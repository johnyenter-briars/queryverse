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

// Calculate the total width of the content required for horizontal scrolling
const MIN_CONTENT_WIDTH = `${COLUMN_COUNT * COLUMN_WIDTH_PX}px`;


export const ResultsWindow = React.memo(() => {
    // Reference for the main DataGrid content container (vertical and horizontal scroll)
    const dataGridScrollRef = useRef<HTMLDivElement>(null);
    // Reference for the top-placed, synchronized horizontal scrollbar
    const topScrollRef = useRef<HTMLDivElement>(null);

    // Synchronize main grid scroll movement to the top scrollbar
    const onBottomScroll = React.useCallback(() => {
        if (dataGridScrollRef.current && topScrollRef.current) {
            topScrollRef.current.scrollLeft = dataGridScrollRef.current.scrollLeft;
        }
    }, []);

    return (
        // The container needs to establish a flex context and fixed height for overflow
        <div 
            className="flex flex-col h-full w-full p-4 bg-gray-900 rounded-xl shadow-2xl"
            style={{ 
                // Ensure the container is constrained vertically to make vertical scrolling possible
                maxHeight: "100%", 
                minHeight: 0,
                backgroundColor: webDarkTheme.colorNeutralBackground1, // Use Fluent theme for background
                color: webDarkTheme.colorNeutralForeground1, // Use Fluent theme for text
            }}
        >
            {/* SECTION 1: Scrollable DataGrid Container
              This container handles both vertical and horizontal scrolling. The header is sticky inside this.
            */}
            <div
                ref={dataGridScrollRef}
                onScroll={onBottomScroll}
                className="flex-1 overflow-auto" // flex-1 allows vertical growth/shrinking, overflow-auto enables scrolling
                style={{
                    // Removed the explicit overflowX: 'hidden' to allow the DataGrid to function correctly.
                    // The top scrollbar is now a synchronized convenience.
                    position: 'relative', // Context for sticky header
                }}
            >
                <DataGrid
                    items={mockData}
                    columns={mockColumns}
                    sortable
                    getRowId={(item) => item.col1}
                    // Set the explicit minimum width to ensure horizontal scrolling is needed
                    style={{ minWidth: MIN_CONTENT_WIDTH }}
                >
                    <DataGridHeader
                        style={{
                            position: "sticky",
                            top: 0,
                            // Ensure the background color is explicitly set to cover content underneath
                            background: webDarkTheme.colorNeutralBackground1,
                            zIndex: 10, // Higher Z-index to ensure it sits above body rows
                            boxShadow: `0 2px 4px rgba(0, 0, 0, 0.4)`, // Subtle shadow for lift
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