import * as React from "react";
import { useEffect, useRef, useState } from "react";
//@ts-expect-error I guess monaco-vim has no index.d.ts?
import { initVimMode } from "monaco-vim";
import Editor, { OnMount } from "@monaco-editor/react";
import {
	FluentProvider,
	webDarkTheme,
	makeStyles,
	shorthands,
	Table,
	TableHeader,
	TableHeaderCell,
	TableBody,
	TableRow,
	TableCell,
	tokens,
} from "@fluentui/react-components";
import { MenuBar } from "./components/MenuBar";

const useStyles = makeStyles({
	root: {
		...shorthands.padding(0),
		...shorthands.margin(0),
		display: "flex",
		flexDirection: "column",
		height: "100vh",
		backgroundColor: webDarkTheme.colorNeutralBackground1,
		color: webDarkTheme.colorNeutralForeground1,
		overflow: "hidden",
	},
	wrapper: {
		flex: 1,
		display: "flex",
		flexDirection: "column",
		minHeight: 0,
	},
	top: {
		flex: 1,
		display: "flex",
		flexDirection: "column",
		minHeight: 0,
		borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
		overflow: "hidden",
	},
	statusBar: {
		height: "24px",
		backgroundColor: "#1e1e1e",
		color: "#ccc",
		display: "flex",
		alignItems: "center",
		paddingLeft: "10px",
		fontFamily: "monospace",
		borderTop: "1px solid #333",
		flexShrink: 0,
	},
	bottom: {
		flex: 1,
		overflow: "auto",
		padding: "1rem",
	},
	table: {
		width: "100%",
		borderCollapse: "collapse",
		"& th, & td": {
			padding: "0.5rem 1rem",
			textAlign: "left",
		},
		"& th": {
			borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
			color: tokens.colorNeutralForeground3,
		},
	},
});

const columns = ["ID", "Name", "Role", "Status"];
const mockData = Array.from({ length: 10 }).map((_, i) => ({
	id: i + 1,
	name: `User ${i + 1}`,
	role: i % 2 === 0 ? "Developer" : "Designer",
	status: i % 3 === 0 ? "Online" : "Offline",
}));

export default function App() {
	const styles = useStyles();
	const vimModeRef = useRef<any>(null);
	const statusBarRef = useRef<HTMLDivElement>(null);

	const handleEditorMount: OnMount = (editor) => {
		if (statusBarRef.current) {
			vimModeRef.current = initVimMode(editor, statusBarRef.current);
		}
	};

	useEffect(() => {
		return () => {
			if (vimModeRef.current) vimModeRef.current.dispose();
		};
	}, []);

	return (
		<FluentProvider theme={webDarkTheme}>
			<div className={styles.root}>
				<MenuBar />

				<div className={styles.wrapper}>
					{/* Editor + Vim status */}
					<div className={styles.top}>
						<Editor
							height="100%"
							defaultLanguage="javascript"
							defaultValue={`// Vim mode enabled`}
							theme="vs-dark"
							onMount={handleEditorMount}
						/>
						<div ref={statusBarRef} className={styles.statusBar}>
							-- NORMAL --
						</div>
					</div>

					{/* Bottom table */}
					<div className={styles.bottom}>
						<h3 style={{ marginBottom: "0.5rem" }}>Team Members</h3>
						<Table className={styles.table}>
							<TableHeader>
								<TableRow>
									{columns.map((col) => (
										<TableHeaderCell key={col}>{col}</TableHeaderCell>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{mockData.map((row) => (
									<TableRow key={row.id}>
										<TableCell>{row.id}</TableCell>
										<TableCell>{row.name}</TableCell>
										<TableCell>{row.role}</TableCell>
										<TableCell>{row.status}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>



			</div>
		</FluentProvider>
	);
}

