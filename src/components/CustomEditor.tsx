import { useCallback, useEffect, useRef, useState } from "react";
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
    debounceMs?: number;
}

export function CustomEditor({
    vimEnabled,
    value,
    onChange,
    language,
    readOnly,
    debounceMs,
}: ICustomEditor) {
    const styles = useCustomEditorStyles();
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const effectiveDebounceMs = debounceMs ?? 200;

    // Keep the editor responsive by buffering keystrokes locally and
    // committing to app state on a short debounce and on blur.
    const [localValue, setLocalValue] = useState<string>(value);

    useEffect(() => {
        // Sync when the active tab/value changes externally.
        setLocalValue(value);
    }, [value]);

    const flushChange = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        onChange(localValue);
    }, [localValue, onChange]);

    const scheduleChange = useCallback(
        (nextValue: string) => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
                debounceTimerRef.current = null;
                onChange(nextValue);
            }, effectiveDebounceMs);
        },
        [effectiveDebounceMs, onChange]
    );

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;
        editor.focus();
        editor.onDidBlurEditorText(() => {
            // Ensure the latest keystrokes are committed when focus leaves.
            const modelValue = editor.getModel()?.getValue();
            if (typeof modelValue === "string") {
                setLocalValue(modelValue);
                onChange(modelValue);
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                }
            } else {
                flushChange();
            }
        });
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
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (vimModeRef.current) vimModeRef.current.dispose();
        };
    }, []);

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Editor
                height="100%"
                language={language ?? "sql"}
                value={localValue}
                theme="vs-dark"
                onMount={handleEditorMount}
                onChange={(v) => {
                    const nextValue = v || "";
                    setLocalValue(nextValue);
                    scheduleChange(nextValue);
                }}
                options={{ readOnly: Boolean(readOnly) }}
            />
            <div ref={statusBarRef} className={styles.statusBar}>
            </div>

        </div>
    );
}
