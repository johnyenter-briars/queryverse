import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
//@ts-expect-error monaco-vim has no type declarations
import { initVimMode } from "monaco-vim";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, Position, IDisposable } from "monaco-editor";
type MonacoApi = typeof import("monaco-editor");
import { useCustomEditorStyles } from "../styles/CustomEditorStyles";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { EntityAttribute } from "../binding/model/EntityAttribute";
import {
    findSelectedEntity,
    findDeleteEntity,
    findUpdateEntity,
    getSqlCompletionItems,
    getSqlTableNames,
} from "../utility/editorIntellisense";
import { analyzeSql, SqlParseContext } from "../utility/sqlParser";
import { matchesPrimaryModifier } from "../settings/shortcuts";

const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;

interface ICustomEditor {
    vimEnabled: boolean;
    value: string;
    onChange: (value: string) => void;
    onEntitySelected?: (logicalName: string) => void;
    onEntitiesSelected?: (logicalNames: string[]) => void;
    fontSize?: number;
    language?: string;
    readOnly?: boolean;
    debounceMs?: number;
    entityDefinitions?: EntityDefinition[];
    entityAttributes?: Record<string, EntityAttribute[]>;
}

export type CustomEditorHandle = {
    getValue: () => string;
};

export const CustomEditor = forwardRef<CustomEditorHandle, ICustomEditor>(({
    vimEnabled,
    value,
    onChange,
    onEntitySelected,
    onEntitiesSelected,
    fontSize,
    language,
    readOnly,
    entityDefinitions,
    entityAttributes,
}: ICustomEditor, ref) => {
    const styles = useCustomEditorStyles();
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<MonacoApi | null>(null);
    const completionDisposableRef = useRef<IDisposable | null>(null);
    const [monacoReady, setMonacoReady] = useState(false);
    const wheelCleanupRef = useRef<(() => void) | null>(null);
    const [localFontSize, setLocalFontSize] = useState(
        fontSize ?? DEFAULT_FONT_SIZE
    );
    const lastEntityRef = useRef<string | null>(null);
    const lastEntitiesRef = useRef<string[]>([]);
    const parseContextRef = useRef<SqlParseContext | null>(null);
    const lastUpdateEntityRef = useRef<string | null>(null);
    const lastDeleteEntityRef = useRef<string | null>(null);

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

    useImperativeHandle(ref, () => ({
        getValue: () => {
            const modelValue = editorRef.current?.getModel()?.getValue();
            return typeof modelValue === "string" ? modelValue : localValue;
        },
    }), [localValue]);

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

        if (vimEnabled && !readOnly && statusBarRef.current) {
            vimModeRef.current = initVimMode(editor, statusBarRef.current);
        }

        const domNode = editor.getDomNode();
        if (domNode) {
            const handleWheel = (event: WheelEvent) => {
                if (!matchesPrimaryModifier(event)) return;
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
        const tableNames = getSqlTableNames(entityDefinitions);

        completionDisposableRef.current = monaco.languages.registerCompletionItemProvider("sql", {
            triggerCharacters: [" ", ",", ".", "n", "N"],
            provideCompletionItems: (
                model: MonacoEditor.ITextModel,
                position: Position
            ) => {
                const suggestions = getSqlCompletionItems({
                    monaco,
                    model,
                    position,
                    entityDefinitions,
                    entityAttributes,
                    tableNames,
                    parseContext: parseContextRef.current,
                });

                return { suggestions };
            },
        });
    }, [entityAttributes, entityDefinitions, language, monacoReady]);

    useEffect(() => {
        if ((language ?? "sql") !== "sql") return;
        if (!monacoRef.current || !editorRef.current || !monacoReady) return;
        if (!entityDefinitions?.length) return;

        const monaco = monacoRef.current;
        const model = editorRef.current.getModel();
        if (!model) return;

        const handle = window.setTimeout(() => {
                const { context, error } = analyzeSql(localValue, entityDefinitions);
                parseContextRef.current = context;
            if (context?.tables?.length && onEntitiesSelected) {
                const logicalNames = context.tables
                    .map((table) => table.logicalName)
                    .filter((name): name is string => Boolean(name));
                if (
                    logicalNames.length &&
                    (logicalNames.length !== lastEntitiesRef.current.length ||
                        logicalNames.some(
                            (name, index) => name !== lastEntitiesRef.current[index]
                        ))
                ) {
                    lastEntitiesRef.current = [...logicalNames];
                    onEntitiesSelected(logicalNames);
                }
            }

            if (error) {
                const line = error.line ?? 1;
                const column = error.column ?? 1;
                monaco.editor.setModelMarkers(model, "sql-intellisense", [
                    {
                        severity: monaco.MarkerSeverity.Error,
                        message: error.message,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: column + 1,
                    },
                ]);
            } else {
                monaco.editor.setModelMarkers(model, "sql-intellisense", []);
            }
        }, 300);

        return () => window.clearTimeout(handle);
    }, [entityDefinitions, language, localValue, monacoReady, onEntitiesSelected]);

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
                onChange(nextValue);
                const selected = findSelectedEntity(
                    nextValue,
                    entityDefinitions
                );
                if (selected !== lastEntityRef.current) {
                    lastEntityRef.current = selected;
                    if (selected && onEntitySelected) {
                        onEntitySelected(selected);
                    }
                }

                const updateSelected = findUpdateEntity(
                    nextValue,
                    entityDefinitions
                );
                if (updateSelected !== lastUpdateEntityRef.current) {
                    lastUpdateEntityRef.current = updateSelected;
                    if (updateSelected && onEntitySelected) {
                        onEntitySelected(updateSelected);
                    }
                }

                const deleteSelected = findDeleteEntity(
                    nextValue,
                    entityDefinitions
                );
                if (deleteSelected !== lastDeleteEntityRef.current) {
                    lastDeleteEntityRef.current = deleteSelected;
                    if (deleteSelected && onEntitySelected) {
                        onEntitySelected(deleteSelected);
                    }
                }
            }}
                options={{ readOnly: Boolean(readOnly), fontSize: localFontSize }}
            />
            <div ref={statusBarRef} className={styles.statusBar}>
            </div>

        </div>
    );
});
