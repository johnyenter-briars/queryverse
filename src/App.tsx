import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
//@ts-expect-error monaco-vim has no type declarations I guess?
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
import "monaco-vim";
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
	top: {
		flexBasis: "50%",
		flexGrow: 0,
		flexShrink: 0,
		minHeight: 0, // allows editor to size properly inside flex
		borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
		overflow: "hidden", // critical for Monaco
		display: "flex",
		flexDirection: "column",
	},
	bottom: {
		flexBasis: "50%",
		flexGrow: 1,
		minHeight: 0,
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
	const [code, setCode] = useState("// Start typing code here...\n");
	const [greetMsg, setGreetMsg] = useState("");
	const vimStatusRef = useRef<HTMLDivElement | null>(null);
	const vimModeRef = useRef<any>(null);
	const statusBarRef = useRef<HTMLDivElement>(null);

	async function greet(name: string) {
		const msg = await invoke<string>("greet", { name });
		setGreetMsg(msg);
	}

	const handleEditorMount: OnMount = (editor, monaco) => {
		if (statusBarRef.current) {
			vimModeRef.current = initVimMode(editor, statusBarRef.current);
		}
	};

	// Clean up vim mode when component unmounts
	useEffect(() => {
		return () => {
			if (vimModeRef.current) {
				vimModeRef.current.dispose();
			}
		};
	}, []);



	return (
		<FluentProvider theme={webDarkTheme} className={styles.root}>
			<MenuBar />

			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					borderBottom: "1px solid #333",
					minHeight: 0,
				}}
			>
				<Editor
					height="100%"
					defaultLanguage="javascript"
					defaultValue={`// Vim mode enabled`}
					theme="vs-dark"
					onMount={handleEditorMount}
				/>
				<div
					id="my-statusbar"
					ref={statusBarRef}
					style={{
						height: "24px",
						backgroundColor: "#1e1e1e",
						color: "#ccc",
						display: "flex",
						alignItems: "center",
						paddingLeft: "10px",
						fontFamily: "monospace",
						borderTop: "1px solid #333",
						flexShrink: 0,
					}}
				>
					-- NORMAL --
				</div>
			</div>

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
				<p style={{ marginTop: "1rem", color: "#999" }}>{greetMsg}</p>
			</div>
		</FluentProvider>
	);
}

