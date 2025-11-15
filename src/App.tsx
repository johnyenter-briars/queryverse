import * as React from "react";
import { useState } from "react";
//@ts-expect-error monaco-vim has no type declarations
import { initVimMode } from "monaco-vim";
import {
	FluentProvider,
	webDarkTheme,
	makeStyles,
	shorthands,
	tokens,
} from "@fluentui/react-components";
import { MenuBar } from "./components/MenuBar";
import { CustomEditor } from "./components/CustomEditor";
import { ResultsWindow } from "./components/ResultsWindow";

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
	bottom: {
		flex: 1,
		overflow: "auto",
		padding: "1rem",
	},
});

export default function App() {
	const styles = useStyles();

	const [vimEnabled, setVimEnabled] = useState(true);

	return (
		<FluentProvider theme={webDarkTheme}>
			<div className={styles.root}>
				<MenuBar
					vimEnabled={vimEnabled}
					onToggleVim={() => setVimEnabled(!vimEnabled)}
				/>

				<div className={styles.wrapper}>
					<div className={styles.top}>
						<CustomEditor
							vimEnabled={vimEnabled}
						/>
					</div>
					<div className={styles.bottom}>
						<ResultsWindow />
					</div>
				</div>
			</div>
		</FluentProvider>
	);
}

