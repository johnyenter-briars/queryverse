import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
//@ts-expect-error monaco-vim has no type declarations
import { initVimMode } from "monaco-vim";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, Position, IDisposable } from "monaco-editor";
import { getTabsterAttribute } from "tabster";
type MonacoApi = typeof import("monaco-editor");
import { useCustomEditorStyles } from "../styles/CustomEditorStyles";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { EntityAttribute } from "../binding/model/EntityAttribute";
import { EntityRelationship } from "../binding/model/EntityRelationship";
import {
    findSelectedEntity,
    findDeleteEntity,
    findUpdateEntity,
    getSqlCompletionItems,
    getSqlTableNames,
} from "../utility/editorIntellisense";
import {
    analyzeSql,
    isolateSqlStatementAtOffset,
    SqlParseContext,
} from "../utility/sqlParser";

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
    entityRelationships?: Record<string, EntityRelationship[]>;
}

export type CustomEditorHandle = {
    getValue: () => string;
    getSelectedText: () => string;
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
    entityRelationships,
}: ICustomEditor, ref) => {
    const styles = useCustomEditorStyles();
    const uncontrolledCompletelyAttributes = getTabsterAttribute({
        uncontrolled: { completely: true },
    });
    const vimModeRef = useRef<any>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<MonacoApi | null>(null);
    const completionDisposableRef = useRef<IDisposable | null>(null);
    const cursorDisposableRef = useRef<IDisposable | null>(null);
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
    const lastSyncedValueRef = useRef<string>(value);

    const [localValue, setLocalValue] = useState<string>(value);
    const [cursorOffset, setCursorOffset] = useState(0);

    useEffect(() => {
        const editor = editorRef.current;
        const model = editor?.getModel?.();

        if (!model) {
            setLocalValue(value);
            lastSyncedValueRef.current = value;
            return;
        }

        const currentValue = model.getValue();
        if (value === lastSyncedValueRef.current || value === currentValue) {
            return;
        }

        model.setValue(value);
        setLocalValue(value);
        lastSyncedValueRef.current = value;
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
        getSelectedText: () => {
            const editor = editorRef.current;
            const model = editor?.getModel?.();
            const selection = editor?.getSelection?.();

            if (!model || !selection) {
                return "";
            }

            return model.getValueInRange(selection);
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
                when: "suggestWidgetVisible",
            },
        ]);

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

        cursorDisposableRef.current = editor.onDidChangeCursorPosition((event) => {
            const model = editor.getModel();
            if (!model) {
                setCursorOffset(0);
                return;
            }
            setCursorOffset(model.getOffsetAt(event.position));
        });
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
            if (cursorDisposableRef.current) cursorDisposableRef.current.dispose();
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
                    entityRelationships,
                    tableNames,
                    parseContext: parseContextRef.current,
                });

                return { suggestions };
            },
        });
    }, [entityAttributes, entityDefinitions, entityRelationships, language, monacoReady]);

    useEffect(() => {
        if ((language ?? "sql") !== "sql") return;
        if (!monacoRef.current || !editorRef.current || !monacoReady) return;
        if (!entityDefinitions?.length) return;

        const monaco = monacoRef.current;
        const model = editorRef.current.getModel();
        if (!model) return;

        const handle = window.setTimeout(() => {
            const statement = isolateSqlStatementAtOffset(localValue, cursorOffset);
            const { context, error } = analyzeSql(statement.text, entityDefinitions);
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
                const statementStartPosition = model.getPositionAt(statement.startOffset);
                const line =
                    (statementStartPosition.lineNumber - 1) + (error.line ?? 1);
                const column =
                    (error.line ?? 1) > 1
                        ? error.column ?? 1
                        : statementStartPosition.column + ((error.column ?? 1) - 1);
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
    }, [cursorOffset, entityDefinitions, language, localValue, monacoReady, onEntitiesSelected]);

    return (
        <div
            {...uncontrolledCompletelyAttributes}
            // Monaco needs full control of Tab handling. The weaker uncontrolled
            // mode still allows Tabster to move focus out of the editor.
            className={styles.root}
        >
            <Editor
                height="100%"
                language={language ?? "sql"}
                defaultValue={value}
                theme="vs-dark"
                onMount={handleEditorMount}
                onChange={(v) => {
                    const nextValue = v || "";
                    setLocalValue(nextValue);
                    lastSyncedValueRef.current = nextValue;
                    onChange(nextValue);
                    const model = editorRef.current?.getModel?.();
                    const position = editorRef.current?.getPosition?.();
                    const offset =
                        model && position ? model.getOffsetAt(position) : nextValue.length;
                    const statement = isolateSqlStatementAtOffset(nextValue, offset);
                    const selected = findSelectedEntity(
                        statement.text,
                        entityDefinitions
                    );
                    if (selected !== lastEntityRef.current) {
                        lastEntityRef.current = selected;
                        if (selected && onEntitySelected) {
                            onEntitySelected(selected);
                        }
                    }

                    const updateSelected = findUpdateEntity(
                        statement.text,
                        entityDefinitions
                    );
                    if (updateSelected !== lastUpdateEntityRef.current) {
                        lastUpdateEntityRef.current = updateSelected;
                        if (updateSelected && onEntitySelected) {
                            onEntitySelected(updateSelected);
                        }
                    }

                    const deleteSelected = findDeleteEntity(
                        statement.text,
                        entityDefinitions
                    );
                    if (deleteSelected !== lastDeleteEntityRef.current) {
                        lastDeleteEntityRef.current = deleteSelected;
                        if (deleteSelected && onEntitySelected) {
                            onEntitySelected(deleteSelected);
                        }
                    }
                }}
                options={{
                    readOnly: Boolean(readOnly),
                    fontSize: localFontSize,
                    acceptSuggestionOnEnter: "off",
                    automaticLayout: true,
                }}
            />
            <div ref={statusBarRef} className={styles.statusBar}>
            </div>

        </div>
    );
});
