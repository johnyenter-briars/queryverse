import * as React from "react";
import {
	DataGrid,
	DataGridHeader,
	DataGridHeaderCell,
	DataGridBody,
	DataGridRow,
	DataGridCell,
	createTableColumn,
	TableColumnDefinition,
	TableCellLayout,
	FluentProvider,
	webDarkTheme,
} from "@fluentui/react-components";

type Item = {
	id: number;
	name: string;
	role: string;
	status: string;
};

const columns: TableColumnDefinition<Item>[] = [
	createTableColumn<Item>({
		columnId: "id",
		renderHeaderCell: () => "ID",
		renderCell: (item) => item.id,
	}),
	createTableColumn<Item>({
		columnId: "name",
		renderHeaderCell: () => "Name",
		renderCell: (item) => item.name,
	}),
	createTableColumn<Item>({
		columnId: "role",
		renderHeaderCell: () => "Role",
		renderCell: (item) => item.role,
	}),
	createTableColumn<Item>({
		columnId: "status",
		renderHeaderCell: () => "Status",
		renderCell: (item) => item.status,
	}),
];

const mockData: Item[] = Array.from({ length: 50 }).map((_, i) => ({
	id: i + 1,
	name: `User ${i + 1}`,
	role: i % 2 === 0 ? "Developer" : "Designer",
	status: i % 3 === 0 ? "Online" : "Offline",
}));

export function ResultsWindow() {
	return (
		<FluentProvider theme={webDarkTheme}>
			<h3 style={{ marginBottom: "0.5rem" }}>Team Members</h3>
			<div style={{ height: "400px", overflow: "auto" }}>
				<DataGrid
					items={mockData}
					columns={columns}
					sortable
					selectionMode="multiselect"
					getRowId={(item) => item.id}
					style={{ minWidth: "600px" }}
				>
					<DataGridHeader
						style={{
							position: "sticky",
							top: 0,
							background: webDarkTheme.colorNeutralBackground1,
							zIndex: 1,
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
		</FluentProvider>
	);
}