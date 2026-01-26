import { useEffect, useRef } from "react";
//@ts-expect-error monaco-vim has no type declarations
import { initVimMode } from "monaco-vim";
import Editor, { OnMount } from "@monaco-editor/react";
import { useCustomEditorStyles } from "../styles/CustomEditorStyles";

interface ICustomEditor {
    vimEnabled: boolean;
    value: string;
    onChange: (value: string) => void;
    language?: string;
    readOnly?: boolean;
}

export function CustomEditor({
    vimEnabled,
    value,
    onChange,
    language,
    readOnly,
}: ICustomEditor) {
    const styles = useCustomEditorStyles();
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;
        editor.focus();
        if (vimEnabled && !readOnly && statusBarRef.current) {
            vimModeRef.current = initVimMode(editor, statusBarRef.current);
        }
    };

    useEffect(() => {
        if (!editorRef.current || !statusBarRef.current) return;

        if (readOnly && vimModeRef.current) {
            vimModeRef.current.dispose();
            vimModeRef.current = null;
            return;
        }

        if (vimEnabled && !readOnly && !vimModeRef.current) {
            vimModeRef.current = initVimMode(editorRef.current, statusBarRef.current);
        } else if ((!vimEnabled || readOnly) && vimModeRef.current) {
            vimModeRef.current.dispose();
            vimModeRef.current = null;
        }
    }, [vimEnabled, readOnly]);

    useEffect(() => {
        return () => {
            if (vimModeRef.current) vimModeRef.current.dispose();
        };
    }, []);

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Editor
                height="100%"
                language={language ?? "sql"}
                value={value}
                theme="vs-dark"
                onMount={handleEditorMount}
                onChange={(v) => onChange(v || "")}
                options={{ readOnly: Boolean(readOnly) }}
            />
            <div ref={statusBarRef} className={styles.statusBar}>
            </div>

        </div>
    );
}
