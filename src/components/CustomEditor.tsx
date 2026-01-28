import { useCallback, useEffect, useRef, useState } from "react";
//@ts-expect-error monaco-vim has no type declarations
import { initVimMode } from "monaco-vim";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, Position, IDisposable } from "monaco-editor";
type MonacoApi = typeof import("monaco-editor");
import { useCustomEditorStyles } from "../styles/CustomEditorStyles";
import { EntityDefinition } from "../binding/model/EntityDefinition";

const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;

interface ICustomEditor {
    vimEnabled: boolean;
    value: string;
    onChange: (value: string) => void;
    fontSize?: number;
    language?: string;
    readOnly?: boolean;
    debounceMs?: number;
    entityDefinitions?: EntityDefinition[];
}

export function CustomEditor({
    vimEnabled,
    value,
    onChange,
    fontSize,
    language,
    readOnly,
    debounceMs,
    entityDefinitions,
}: ICustomEditor) {
    const styles = useCustomEditorStyles();
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<MonacoApi | null>(null);
    const completionDisposableRef = useRef<IDisposable | null>(null);
    const [monacoReady, setMonacoReady] = useState(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wheelCleanupRef = useRef<(() => void) | null>(null);
    const effectiveDebounceMs = debounceMs ?? 200;
    const [localFontSize, setLocalFontSize] = useState(
        fontSize ?? DEFAULT_FONT_SIZE
    );

    // Keep the editor responsive by buffering keystrokes locally and
    // committing to app state on a short debounce and on blur.
    const [localValue, setLocalValue] = useState<string>(value);

    useEffect(() => {
        // Sync when the active tab/value changes externally.
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (fontSize === undefined) return;
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));
        setLocalFontSize(clamped);
        editorRef.current?.updateOptions({ fontSize: clamped });
    }, [fontSize]);

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

    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        setMonacoReady(true);

        editor.updateOptions({ fontSize: localFontSize });
        editor.focus();

        monaco.editor.addKeybindingRules([
            {
                keybinding: monaco.KeyCode.Tab,
                command: "acceptSelectedSuggestion",
            },
        ]);

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

        const domNode = editor.getDomNode();
        if (domNode) {
            const handleWheel = (event: WheelEvent) => {
                if (!event.ctrlKey) return;
                event.preventDefault();
                event.stopPropagation();
                const direction = event.deltaY < 0 ? 1 : -1;
                setLocalFontSize((prev) => {
                    const next = Math.min(
                        MAX_FONT_SIZE,
                        Math.max(MIN_FONT_SIZE, prev + direction)
                    );
                    editor.updateOptions({ fontSize: next });
                    return next;
                });
            };

            domNode.addEventListener("wheel", handleWheel, { passive: false });
            wheelCleanupRef.current = () => {
                domNode.removeEventListener("wheel", handleWheel);
            };
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
            if (completionDisposableRef.current) completionDisposableRef.current.dispose();
            if (wheelCleanupRef.current) wheelCleanupRef.current();
        };
    }, []);

    useEffect(() => {
        if ((language ?? "sql") !== "sql") return;
        if (!monacoRef.current || !monacoReady) return;

        if (completionDisposableRef.current) {
            completionDisposableRef.current.dispose();
            completionDisposableRef.current = null;
        }

        if (!entityDefinitions?.length) return;

        const monaco = monacoRef.current;
        const tableNames = Array.from(
            new Set(
                entityDefinitions
                    .flatMap((definition) => [
                        definition.LogicalName,
                    ])
                    .filter((name): name is string => Boolean(name))
            )
        ).sort((a, b) => a.localeCompare(b));

        completionDisposableRef.current = monaco.languages.registerCompletionItemProvider("sql", {
            triggerCharacters: [" "],
            provideCompletionItems: (
                model: MonacoEditor.ITextModel,
                position: Position
            ) => {
                const lineText = model.getLineContent(position.lineNumber);
                const prefix = lineText.slice(0, Math.max(position.column - 1, 0));
                const match = prefix.match(/\bfrom\s+([A-Za-z0-9_\[\]\"]*)$/i);
                if (!match) return { suggestions: [] };

                const current = match[1] ?? "";
                const range = new monaco.Range(
                    position.lineNumber,
                    position.column - current.length,
                    position.lineNumber,
                    position.column
                );

                const suggestions = tableNames
                    .filter((name) => name.toLowerCase().startsWith(current.toLowerCase()))
                    .map((name) => ({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: name,
                        range,
                    }));

                return { suggestions };
            },
        });
    }, [entityDefinitions, language, monacoReady]);

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
                options={{ readOnly: Boolean(readOnly), fontSize: localFontSize }}
            />
            <div ref={statusBarRef} className={styles.statusBar}>
            </div>

        </div>
    );
}
