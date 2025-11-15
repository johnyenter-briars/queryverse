import * as React from "react";
import { useEffect, useRef, useState } from "react";
//@ts-expect-error monaco-vim has no type declarations
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

const useStyles = makeStyles({
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
});

interface ICustomEditor {
    vimEnabled: boolean;
}

export function CustomEditor({ vimEnabled }: ICustomEditor) {
    const styles = useStyles();
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);

    const [code, setCode] = useState("-- Start typing SQL here...\n");

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;
        if (vimEnabled && statusBarRef.current) {
            vimModeRef.current = initVimMode(editor, statusBarRef.current);
        }
    };

    // Toggle Vim mode programmatically
    useEffect(() => {
        if (!editorRef.current || !statusBarRef.current) return;

        // If Vim should be enabled
        if (vimEnabled && !vimModeRef.current) {
            vimModeRef.current = initVimMode(editorRef.current, statusBarRef.current);
        } else if (!vimEnabled && vimModeRef.current) {
            vimModeRef.current.dispose();
            vimModeRef.current = null;
        }
    }, [vimEnabled]);

    useEffect(() => {
        return () => {
            if (vimModeRef.current) vimModeRef.current.dispose();
        };
    }, []);

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Editor
                height="100%"
                defaultLanguage="sql"
                value={code}
                theme="vs-dark"
                onMount={handleEditorMount}
                onChange={(v) => setCode(v || "")}
            />
            <div ref={statusBarRef} className={styles.statusBar}>
            </div>

        </div>
    );
}