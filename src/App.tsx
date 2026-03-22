import { useEffect, useRef, useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    TabList,
    Tab,
    Button,
    Text,
} from "@fluentui/react-components";
import { Add24Regular, Copy24Regular } from "@fluentui/react-icons";
import { listen } from "@tauri-apps/api/event";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor, type CustomEditorHandle } from "./components/CustomEditor";
import { ShortcutManager } from "./components/ShortcutManager";
import { ModalDialog } from "./components/ModalDialog";
import {
    DataChangeConfirmModal,
    type DataChangeAction,
    type RequestParameterStatus,
} from "./components/DataChangeConfirmModal";
import { SettingsModal } from "./components/SettingsModal";
import { TabSwitcher } from "./components/TabSwitcher";
import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
import { ConnectionTreeList } from "./components/ConnectionTreeList";
import { SchemaEntityView } from "./components/SchemaEntityView";
import { SchemaExplorerMenu } from "./components/SchemaExplorerMenu";
import { combineClasses } from "./utility/class";
import { ResultRow } from "./binding/model/ResultRow";
import { FetchXmlPreview } from "./binding/model/FetchXmlPreview";
import { Connection } from "./binding/model/Connection";
import { ConnectionTreeItem } from "./binding/model/ConnectionTreeItem";
import {
    cancelBackgroundJob,
    discardDeleteSql,
    discardUpdateSql,
    executeDeleteSql,
    executeSql,
    executeUpdateSql,
    getBackgroundJobResult,
    getBackgroundJobStatus,
    getSettings,
    getLaunchContext,
    listConnectionTree,
    listConnections,
    listEntityAttributes,
    listEntityDefinitions,
    listEntityRelationships,
    openSqlFile,
    openSqlFilePath,
    previewFetchXml,
    prepareDeleteSql,
    prepareUpdateSql,
    saveSqlFile,
    saveSqlFileAs,
    saveSettings,
    setConnection,
    splitSqlParts,
} from "./binding/function";
import { ShortcutActionId } from "./settings/shortcuts";
import { useAppStyles } from "./styles/AppStyles";
import { EntityDefinition } from "./binding/model/EntityDefinition";
import { EntityAttribute } from "./binding/model/EntityAttribute";
import { EntityRelationship } from "./binding/model/EntityRelationship";
import { SqlQueryMetadata } from "./binding/model/SqlQueryMetadata";
import { DEFAULT_SETTINGS, Settings } from "./binding/model/Settings";
import { DeleteSqlExecuteResponse } from "./binding/model/DeleteSqlExecuteResponse";
import { UpdateSqlExecuteResponse } from "./binding/model/UpdateSqlExecuteResponse";
import { logDebug, logError } from "./utility/logging";
import { AppToaster, useAppToast } from "./utility/toast";
import { BackgroundJobStatus } from "./binding/model/BackgroundJobStatus";

const DEFAULT_QUERY = "select top 20 *\nfrom account";
const isUpdateQuery = (sql: string) => /^\s*update\b/i.test(sql);
const isDeleteQuery = (sql: string) => /^\s*delete\b/i.test(sql);
type EditorTab = {
    kind: "query" | "fetchxml" | "schema";
    id: number;
    title: string;
    query: string;
    filePath: string | null;
    fileName: string | null;
    lastSavedQuery: string;
    isEditorDirty: boolean;
    results: ResultRow[];
    connectionId: string | null;
    fetchPreview: FetchXmlPreview | null;
    previewError: string | null;
    executeError: string | null;
    isExecuting: boolean;
    loadingMessage: string | null;
    currentJobId: string | null;
    resultLayout: "grid" | "details";
    queryMetadata: SqlQueryMetadata | null;
    extraResultPanes: QueryResultPane[];
    schemaLogicalName?: string | null;
    schemaDisplayName?: string | null;
};

type QueryResultPane = {
    id: string;
    title: string;
    query: string;
    results: ResultRow[];
    executeError: string | null;
    isExecuting: boolean;
    loadingMessage: string | null;
    currentJobId: string | null;
    resultLayout: "grid" | "details";
    queryMetadata: SqlQueryMetadata | null;
};

const PRIMARY_RESULT_PANE_ID = "primary";

const createQueryResultPane = (
    id: string,
    title: string,
    query: string
): QueryResultPane => ({
    id,
    title,
    query,
    results: [],
    executeError: null,
    isExecuting: false,
    loadingMessage: null,
    currentJobId: null,
    resultLayout: "grid",
    queryMetadata: null,
});

type DeviceCodeAuthModalState = {
    open: boolean;
    verificationUri: string;
    verificationUriComplete: string | null;
    userCode: string;
    message: string;
    stage: "code" | "waiting" | "success" | "error";
};

const createQueryTab = (id: number): EditorTab => ({
    kind: "query",
    id,
    title: `Query ${id}`,
    query: DEFAULT_QUERY,
    filePath: null,
    fileName: null,
    lastSavedQuery: DEFAULT_QUERY,
    isEditorDirty: false,
    results: [],
    connectionId: null,
    fetchPreview: null,
    previewError: null,
    executeError: null,
    isExecuting: false,
    loadingMessage: null,
    currentJobId: null,
    resultLayout: "grid",
    queryMetadata: null,
    extraResultPanes: [],
});

const createFetchXmlTab = (
    id: number,
    title: string,
    fetchXml: string,
    connectionId: string | null
): EditorTab => ({
    kind: "fetchxml",
    id,
    title,
    query: fetchXml,
    filePath: null,
    fileName: null,
    lastSavedQuery: fetchXml,
    isEditorDirty: false,
    results: [],
    connectionId,
    fetchPreview: null,
    previewError: null,
    executeError: null,
    isExecuting: false,
    loadingMessage: null,
    currentJobId: null,
    resultLayout: "grid",
    queryMetadata: null,
    extraResultPanes: [],
});

const createSchemaTab = (
    id: number,
    title: string,
    logicalName: string,
    displayName: string,
    connectionId: string | null
): EditorTab => ({
    kind: "schema",
    id,
    title,
    query: "",
    filePath: null,
    fileName: null,
    lastSavedQuery: "",
    isEditorDirty: false,
    results: [],
    connectionId,
    fetchPreview: null,
    previewError: null,
    executeError: null,
    isExecuting: false,
    loadingMessage: null,
    currentJobId: null,
    resultLayout: "grid",
    queryMetadata: null,
    extraResultPanes: [],
    schemaLogicalName: logicalName,
    schemaDisplayName: displayName,
});

export default function App() {
    const [connectionsEnabled, setIsMenuOpen] = useState(true);
    const [schemaEnabled, setSchemaEnabled] = useState(false);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [tabs, setTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = useState(0);
    const nextTabId = useRef(1);
    const cliInitRef = useRef(false);
    const tabContextMenuRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<CustomEditorHandle | null>(null);
    const queryPaneRef = useRef<HTMLDivElement | null>(null);
    const jobPollersRef = useRef<Map<string, number>>(new Map());
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [resultsPaneHeight, setResultsPaneHeight] = useState(320);
    const [isResizingResultsPane, setIsResizingResultsPane] = useState(false);
    const [tabContextMenu, setTabContextMenu] = useState<{
        open: boolean;
        x: number;
        y: number;
        tabId: number | null;
    }>({ open: false, x: 0, y: 0, tabId: null });
    const [connectionPickerOpen, setConnectionPickerOpen] = useState(false);
    const [connectionPickerTabId, setConnectionPickerTabId] = useState<number | null>(null);
    const [connectionPickerLoading, setConnectionPickerLoading] = useState(false);
    const [connectionPickerError, setConnectionPickerError] = useState<string | null>(null);
    const [connectionTreeOptions, setConnectionTreeOptions] = useState<ConnectionTreeItem[]>([]);
    const [dataChangeConfirm, setDataChangeConfirm] = useState<{
        open: boolean;
        count: number;
        token: string | null;
        tabId: number | null;
        isLoading: boolean;
        action: DataChangeAction;
        requestParameterStatuses: RequestParameterStatus[];
    }>({
        open: false,
        count: 0,
        token: null,
        tabId: null,
        isLoading: false,
        action: "update",
        requestParameterStatuses: [],
    });

    const [entityDefinitions, setEntityDefinitions] = useState<EntityDefinition[]>([]);
    const [entityAttributesByLogical, setEntityAttributesByLogical] = useState<
        Record<string, EntityAttribute[]>
    >({});
    const [entityRelationshipsByLogical, setEntityRelationshipsByLogical] = useState<
        Record<string, EntityRelationship[]>
    >({});
    const [entityAttributesLoading, setEntityAttributesLoading] = useState<
        Record<string, boolean>
    >({});
    const [entityAttributesError, setEntityAttributesError] = useState<
        Record<string, string | null>
    >({});
    const [deviceCodeModal, setDeviceCodeModal] = useState<DeviceCodeAuthModalState>({
        open: false,
        verificationUri: "",
        verificationUriComplete: null,
        userCode: "",
        message: "",
        stage: "code",
    });
    const { notifyError, notifySuccess, notifyWarning } = useAppToast();

    const styles = useAppStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        (connectionsEnabled || schemaEnabled) && styles.contentShifted
    );

    const vimEnabled = settings.vimEnabled;
    const keyBindingsEnabled = settings.keyBindingsEnabled;
    const editorFontSize = settings.fontSize;

    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    const getEntityDisplayName = (entity: EntityDefinition): string =>
        ((entity.DisplayName as { UserLocalizedLabel?: { Label?: string } } | undefined)
            ?.UserLocalizedLabel?.Label ??
            (entity.DisplayName as { LocalizedLabels?: Array<{ Label?: string }> } | undefined)
                ?.LocalizedLabels?.[0]?.Label ??
            entity.SchemaName ??
            entity.LogicalName);
    const getEntityDefinition = (logicalName: string): EntityDefinition | undefined =>
        entityDefinitions.find(
            (definition) =>
                definition.LogicalName.toLowerCase() === logicalName.toLowerCase()
        );

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            try {
                const response = await getSettings();
                if (!cancelled && response.success) {
                    setSettings({ ...DEFAULT_SETTINGS, ...response.value });
                }
            } catch (error) {
                logError("Failed to load settings", error, "queryverse::frontend::app");
            }
        };

        loadSettings();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return () => {
            for (const timeoutId of jobPollersRef.current.values()) {
                window.clearTimeout(timeoutId);
            }
            jobPollersRef.current.clear();
        };
    }, []);

    useEffect(() => {
        if (!isResizingResultsPane) {
            return;
        }

        const handlePointerMove = (event: MouseEvent) => {
            const container = queryPaneRef.current;
            if (!container) {
                return;
            }

            const bounds = container.getBoundingClientRect();
            const nextHeight = bounds.bottom - event.clientY;
            const minResultsHeight = 180;
            const minEditorHeight = 180;
            const maxResultsHeight = Math.max(
                minResultsHeight,
                bounds.height - minEditorHeight - 12
            );

            setResultsPaneHeight(
                Math.max(minResultsHeight, Math.min(maxResultsHeight, nextHeight))
            );
        };

        const stopResizing = () => {
            setIsResizingResultsPane(false);
        };

        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", stopResizing);

        return () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizingResultsPane]);

    useEffect(() => {
        let unlisten: (() => void) | null = null;

        const subscribe = async () => {
            unlisten = await listen<{
                stage: "code" | "waiting" | "success";
                connectionId?: string | null;
                verificationUri?: string | null;
                verificationUriComplete?: string | null;
                userCode?: string | null;
                message?: string | null;
            }>("device-code-auth", (event) => {
                const payload = event.payload;
                if (payload.stage === "success") {
                    setDeviceCodeModal((prev) => ({
                        ...prev,
                        open: false,
                        stage: "success",
                        message: payload.message ?? "Device code authentication completed.",
                    }));
                    return;
                }

                setDeviceCodeModal((prev) => ({
                    open: true,
                    verificationUri: payload.verificationUri ?? prev.verificationUri,
                    verificationUriComplete:
                        payload.verificationUriComplete ?? prev.verificationUriComplete,
                    userCode: payload.userCode ?? prev.userCode,
                    message: payload.message ?? prev.message,
                    stage: payload.stage,
                }));
            });
        };

        void subscribe();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    const persistSettings = async (nextSettings: Settings) => {
        setSettings({ ...DEFAULT_SETTINGS, ...nextSettings });
        setSettingsSaving(true);
        try {
            const response = await saveSettings(nextSettings);
            if (response.success) {
                setSettings({ ...DEFAULT_SETTINGS, ...response.value });
            }
        } catch (error) {
            logError("Failed to save settings", error, "queryverse::frontend::app");
        } finally {
            setSettingsSaving(false);
        }
    };

    const updateTab = (tabId: number, updater: (tab: EditorTab) => EditorTab) => {
        setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? updater(tab) : tab))
        );
    };

    const getPrimaryResultPane = (tab: EditorTab): QueryResultPane => ({
        id: PRIMARY_RESULT_PANE_ID,
        title: "Results",
        query: tab.query,
        results: tab.results,
        executeError: tab.executeError,
        isExecuting: tab.isExecuting,
        loadingMessage: tab.loadingMessage,
        currentJobId: tab.currentJobId,
        resultLayout: tab.resultLayout,
        queryMetadata: tab.queryMetadata,
    });

    const applyPrimaryResultPane = (
        tab: EditorTab,
        pane: QueryResultPane,
        overrides?: Partial<EditorTab>
    ): EditorTab => ({
        ...tab,
        results: pane.results,
        executeError: pane.executeError,
        isExecuting: pane.isExecuting,
        loadingMessage: pane.loadingMessage,
        currentJobId: pane.currentJobId,
        resultLayout: pane.resultLayout,
        queryMetadata: pane.queryMetadata,
        ...overrides,
    });

    const getAllResultPanes = (tab: EditorTab): QueryResultPane[] =>
        tab.extraResultPanes.length > 0 ? tab.extraResultPanes : [getPrimaryResultPane(tab)];

    const syncTabExecutionState = (
        pane: QueryResultPane,
        extraResultPanes: QueryResultPane[]
    ) => {
        const allPanes = [pane, ...extraResultPanes];
        const anyExecuting = allPanes.some((entry) => entry.isExecuting);
        return {
            isExecuting: anyExecuting,
            loadingMessage: anyExecuting ? "Running queries..." : pane.loadingMessage,
        };
    };

    const updateResultPane = (
        tabId: number,
        paneId: string,
        updater: (pane: QueryResultPane) => QueryResultPane
    ) => {
        updateTab(tabId, (tab) => {
            if (paneId === PRIMARY_RESULT_PANE_ID) {
                const updatedPrimary = updater(getPrimaryResultPane(tab));
                const executionState = syncTabExecutionState(updatedPrimary, tab.extraResultPanes);
                return applyPrimaryResultPane(tab, updatedPrimary, executionState);
            }

            let updatedPrimary = getPrimaryResultPane(tab);
            const updatedExtras = tab.extraResultPanes.map((pane) => {
                if (pane.id !== paneId) {
                    return pane;
                }

                return updater(pane);
            });
            const executionState =
                updatedExtras.length > 0
                    ? {
                          isExecuting: updatedExtras.some((pane) => pane.isExecuting),
                          loadingMessage: updatedExtras.some((pane) => pane.isExecuting)
                              ? "Running queries..."
                              : null,
                      }
                    : syncTabExecutionState(updatedPrimary, updatedExtras);
            updatedPrimary = {
                ...updatedPrimary,
                isExecuting: executionState.isExecuting,
                loadingMessage: executionState.loadingMessage,
            };

            return applyPrimaryResultPane(tab, updatedPrimary, {
                extraResultPanes: updatedExtras,
            });
        });
    };

    const activeResultPanes =
        activeTab && activeTab.kind === "query" ? getAllResultPanes(activeTab) : [];

    useEffect(() => {
        if (!tabContextMenu.open) return;

        const handleClick = (event: MouseEvent) => {
            if (tabContextMenuRef.current?.contains(event.target as Node)) {
                return;
            }
            setTabContextMenu((prev) => ({ ...prev, open: false }));
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setTabContextMenu((prev) => ({ ...prev, open: false }));
            }
        };

        window.addEventListener("click", handleClick, true);
        window.addEventListener("contextmenu", handleClick, true);
        window.addEventListener("keydown", handleKeyDown, true);
        return () => {
            window.removeEventListener("click", handleClick, true);
            window.removeEventListener("contextmenu", handleClick, true);
            window.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [tabContextMenu.open]);

    useEffect(() => {
        if (!connectionPickerOpen) return;

        const loadConnections = async () => {
            setConnectionPickerLoading(true);
            setConnectionPickerError(null);
            try {
                const [connectionsResponse, treeResponse] = await Promise.all([
                    listConnections(),
                    listConnectionTree(),
                ]);
                if (connectionsResponse.success && treeResponse.success) {
                    setConnectionTreeOptions(treeResponse.value);
                } else {
                    setConnectionTreeOptions([]);
                    setConnectionPickerError(
                        connectionsResponse.message ||
                            treeResponse.message ||
                            "Failed to load connections."
                    );
                }
            } catch (error) {
                setConnectionTreeOptions([]);
                setConnectionPickerError(getErrorMessage(error));
            } finally {
                setConnectionPickerLoading(false);
            }
        };

        loadConnections();
    }, [connectionPickerOpen]);

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === "string") return error;
        return "Unknown error";
    };

    const resetDataChangeConfirm = () => {
        setDataChangeConfirm({
            open: false,
            count: 0,
            token: null,
            tabId: null,
            isLoading: false,
            action: "update",
            requestParameterStatuses: [],
        });
    };

    const clearJobPoller = (jobId: string) => {
        const timeoutId = jobPollersRef.current.get(jobId);
        if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            jobPollersRef.current.delete(jobId);
        }
    };

    const buildJobProgressRow = (status: BackgroundJobStatus): ResultRow => {
        const progressPercent =
            status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;
        const batchLabel =
            status.totalBatches > 0
                ? `${status.currentBatch} / ${status.totalBatches}`
                : "0 / 0";

        return {
            attributes: {
                status: status.state,
                currentBatch: status.currentBatch,
                totalBatches: status.totalBatches,
                batch: batchLabel,
                processed: status.processed,
                total: status.total,
                progressPercent,
                message: status.message,
            },
        };
    };

    const buildUpdateSummaryRow = (response: UpdateSqlExecuteResponse): ResultRow => {
        const attributes: ResultRow["attributes"] = {
            success: response.success ? "true" : "false",
            updated: response.updated,
            failed: response.failed,
            message: response.message,
            errorCount: response.errors.length,
            errors: response.errors.join("\n"),
        };

        if (response.errors.length > 0) {
            attributes.firstError = response.errors[0];
        }

        return { attributes };
    };

    const buildDeleteSummaryRow = (response: DeleteSqlExecuteResponse): ResultRow => {
        const attributes: ResultRow["attributes"] = {
            success: response.success ? "true" : "false",
            deleted: response.deleted,
            failed: response.failed,
            message: response.message,
            errorCount: response.errors.length,
            errors: response.errors.join("\n"),
        };

        if (response.errors.length > 0) {
            attributes.firstError = response.errors[0];
        }

        return { attributes };
    };

    const buildCanceledSummaryRow = (status: BackgroundJobStatus): ResultRow => ({
        attributes: {
            status: "canceled",
            currentBatch: status.currentBatch,
            totalBatches: status.totalBatches,
            processed: status.processed,
            total: status.total,
            message: status.message || "Job canceled.",
        },
    });

    const startBackgroundJobPolling = (
        action: DataChangeAction | "select",
        jobId: string,
        tabId: number,
        paneId: string = PRIMARY_RESULT_PANE_ID
    ) => {
        const poll = async () => {
            try {
                const response = await getBackgroundJobStatus(jobId);
                if (!response.success) {
                    throw new Error(response.message || "Failed to load background job status.");
                }

                const status = response.value;

                logDebug(
                    "Background job poll status",
                    {
                        jobId,
                        action,
                        kind: status.kind,
                        state: status.state,
                        currentBatch: status.currentBatch,
                        totalBatches: status.totalBatches,
                        processed: status.processed,
                        total: status.total,
                    },
                    "queryverse::frontend::jobs"
                );

                if (status.state === "running") {
                    updateResultPane(tabId, paneId, (pane) => ({
                        ...pane,
                        results: [buildJobProgressRow(status)],
                        resultLayout: "details",
                        queryMetadata: null,
                        executeError: null,
                        isExecuting: true,
                        loadingMessage: status.message,
                        currentJobId: jobId,
                    }));

                    const timeoutId = window.setTimeout(() => {
                        void poll();
                    }, 1000);
                    jobPollersRef.current.set(jobId, timeoutId);
                    return;
                }

                clearJobPoller(jobId);

                if (status.state === "canceled") {
                    updateResultPane(tabId, paneId, (pane) => ({
                        ...pane,
                        results: [buildCanceledSummaryRow(status)],
                        resultLayout: "details",
                        queryMetadata: null,
                        executeError: null,
                        isExecuting: false,
                        loadingMessage: null,
                        currentJobId: null,
                    }));
                    return;
                }

                if (status.state === "success" || status.state === "failed") {
                    logDebug(
                        "Fetching background job result",
                        {
                            jobId,
                            action,
                            state: status.state,
                        },
                        "queryverse::frontend::jobs"
                    );

                    const resultResponse = await getBackgroundJobResult(jobId);
                    logDebug(
                        "Fetched background job result",
                        {
                            jobId,
                            success: resultResponse.success,
                            message: resultResponse.message,
                        },
                        "queryverse::frontend::jobs"
                    );
                    if ("select" in resultResponse.value) {
                        const selectResult = resultResponse.value as {
                            select: {
                                value: ResultRow[];
                                metadata: SqlQueryMetadata | null;
                            };
                        };
                        updateResultPane(tabId, paneId, (pane) => ({
                            ...pane,
                            results: selectResult.select.value,
                            resultLayout: "grid",
                            queryMetadata: selectResult.select.metadata ?? null,
                            executeError: null,
                            isExecuting: false,
                            loadingMessage: null,
                            currentJobId: jobId,
                        }));
                        return;
                    }

                    const resultRow =
                        "update" in resultResponse.value
                            ? buildUpdateSummaryRow(resultResponse.value.update)
                            : buildDeleteSummaryRow(resultResponse.value.delete);
                    updateResultPane(tabId, paneId, (pane) => ({
                        ...pane,
                        results: [resultRow],
                        resultLayout: "details",
                        queryMetadata: null,
                        executeError: null,
                        isExecuting: false,
                        loadingMessage: null,
                        currentJobId: null,
                    }));
                    return;
                }

                updateResultPane(tabId, paneId, (pane) => ({
                    ...pane,
                    resultLayout: "grid",
                    executeError: status.message || "Background update job failed.",
                    isExecuting: false,
                    loadingMessage: null,
                    currentJobId: null,
                }));
            } catch (error) {
                clearJobPoller(jobId);
                updateResultPane(tabId, paneId, (pane) => ({
                    ...pane,
                    resultLayout: "grid",
                    executeError: getErrorMessage(error),
                    isExecuting: false,
                    loadingMessage: null,
                    currentJobId: null,
                }));
            }
        };

        void poll();
    };

    const buildRequestParameterStatuses = (
        currentSettings: Settings
    ): RequestParameterStatus[] => {
        const businessLogicValue =
            currentSettings.bypassBusinessLogicExecutionCustomSync &&
            currentSettings.bypassBusinessLogicExecutionCustomAsync
                ? "✅ CustomSync + CustomAsync"
                : currentSettings.bypassBusinessLogicExecutionCustomSync
                  ? "✅ CustomSync"
                  : currentSettings.bypassBusinessLogicExecutionCustomAsync
                    ? "✅ CustomAsync"
                    : "❌ Off";

        return [
            {
                label: "BypassBusinessLogicExecution",
                value: businessLogicValue,
                tone:
                    currentSettings.bypassBusinessLogicExecutionCustomSync &&
                    currentSettings.bypassBusinessLogicExecutionCustomAsync
                        ? "active"
                        : currentSettings.bypassBusinessLogicExecutionCustomSync ||
                            currentSettings.bypassBusinessLogicExecutionCustomAsync
                          ? "active"
                          : "inactive",
            },
            {
                label: "BypassBusinessLogicExecutionStepIds",
                value: "⏳ Not implemented yet",
                tone: "todo",
            },
            {
                label: "BypassCustomPluginExecution",
                value: currentSettings.bypassCustomPluginExecution ? "✅ On" : "❌ Off",
                tone: currentSettings.bypassCustomPluginExecution ? "active" : "inactive",
            },
            {
                label: "SuppressCallbackRegistrationExpanderJob",
                value: currentSettings.suppressCallbackRegistrationExpanderJob
                    ? "✅ On"
                    : "❌ Off",
                tone: currentSettings.suppressCallbackRegistrationExpanderJob
                    ? "active"
                    : "inactive",
            },
        ];
    };

    const formatFetchXml = (value: string, useSingleQuotes: boolean): string => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(trimmed, "application/xml");
            if (doc.getElementsByTagName("parsererror").length > 0) {
                return trimmed;
            }
            const serialized = new XMLSerializer().serializeToString(doc);
            const pretty = prettyPrintXml(serialized);
            return useSingleQuotes
                ? pretty.replace(/="([^"]*)"/g, "='$1'")
                : pretty;
        } catch {
            return trimmed;
        }
    };

    const prettyPrintXml = (xml: string): string => {
        const lines = xml.replace(/>\s*</g, ">\n<").trim().split("\n");
        let indent = 0;
        const indentSize = 2;

        return lines
            .filter(Boolean)
            .map((line) => {
                const isClosingTag = /^<\/\w/.test(line);
                const isOpeningTag =
                    /^<[^!?/][^>]*>$/.test(line) &&
                    !/\/>$/.test(line) &&
                    !line.includes("</");

                if (isClosingTag) {
                    indent = Math.max(indent - 1, 0);
                }

                const padded = `${" ".repeat(indent * indentSize)}${line}`;

                if (isOpeningTag) {
                    indent += 1;
                }

                return padded;
            })
            .join("\n");
    };

    useEffect(() => {
        if (cliInitRef.current) return;
        cliInitRef.current = true;

        const initializeFromCli = async () => {
            try {
                const context = await getLaunchContext();
                let connectionToUse: Connection | null = null;

                if (context.connectionName) {
                    const connections = await listConnections();
                    if (connections.success) {
                        const match = connections.value.find(
                            (connection) =>
                                connection.name?.toLowerCase() ===
                                context.connectionName?.toLowerCase()
                        );
                        if (match) {
                            connectionToUse = match;
                            setSelectedConnection(match);
                            if (match.id) {
                                await setConnection(match.id);
                                const response = await listEntityDefinitions();
                                if (response.success) {
                                    setEntityDefinitions(response.value);
                                    setEntityAttributesByLogical({});
                                    setEntityRelationshipsByLogical({});
                                    setEntityAttributesLoading({});
                                    setEntityAttributesError({});
                                }
                            }
                        }
                    }
                }

                if (context.sqlFilePath) {
                    try {
                        const file = await openSqlFilePath(context.sqlFilePath);
                        const connectionName =
                            connectionToUse?.name ?? "No connection";
                        const newId = nextTabId.current++;
                        const newTab = {
                            ...createQueryTab(newId),
                            title: `${file.fileName} - ${connectionName}`,
                            query: file.contents,
                            filePath: file.path,
                            fileName: file.fileName,
                            lastSavedQuery: file.contents,
                            isEditorDirty: false,
                            connectionId: connectionToUse?.id ?? null,
                        };

                        setTabs((prev) => [...prev, newTab]);
                        setActiveTabId(newId);
                    } catch (error) {
                        logError(
                            "Failed to open SQL file from CLI args",
                            error,
                            "queryverse::frontend::app"
                        );
                        notifyError(
                            "Couldn't open SQL file",
                            `File not found: ${context.sqlFilePath}`
                        );
                    }
                }
            } catch (error) {
                logError(
                    "Failed to initialize from CLI args",
                    error,
                    "queryverse::frontend::app"
                );
                notifyError(
                    "Couldn't initialize from CLI args",
                    "Check the provided launch arguments and try again."
                );
            }
        };

        initializeFromCli();
    }, []);

    const openTab = (connection?: Connection | null) => {
        const effectiveConnection = connection ?? selectedConnection;
        const newId = nextTabId.current++;
        const newTab = {
            ...createQueryTab(newId),
            title: effectiveConnection?.name
                ? `Query - ${effectiveConnection.name}`
                : `Query ${newId}`,
            connectionId: effectiveConnection?.id ?? null,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newId);
    };

    const handleAddTab = () => {
        openTab();
    };

    const handleAddTabWithFirstConnection = async () => {
        if (selectedConnection) {
            openTab(selectedConnection);
            return;
        }
        try {
            const response = await listConnections();
            const firstConnection = response.success ? response.value[0] : undefined;
            openTab(firstConnection ?? null);
        } catch {
            openTab(null);
        }
    };

    const handleCloseTab = (id: number) => {
        setTabs((prev) => {
            const nextTabs = prev.filter((tab) => tab.id !== id);
            if (activeTabId !== id) {
                return nextTabs;
            }

            const fallback = nextTabs[nextTabs.length - 1];
            setActiveTabId(fallback ? fallback.id : 0);
            return nextTabs;
        });
    };

    const handleCloseActiveTab = () => {
        if (activeTabId === 0) return;
        handleCloseTab(activeTabId);
    };

    const handleExecuteActiveTab = async () => {
        if (activeTabId === 0) return;
        const targetTab = tabs.find((tab) => tab.id === activeTabId);
        if (!targetTab || targetTab.kind !== "query" || !selectedConnection?.id) {
            return;
        }
        if (targetTab.isEditorDirty) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                executeError: "Save changes before executing the query.",
            }));
            return;
        }

        const selectedText =
            typeof editorRef.current?.getSelectedText === "function"
                ? editorRef.current.getSelectedText()
                : "";
        const selectedQuery = selectedText.trim();
        const queryToExecute =
            selectedQuery.length > 0
                ? selectedQuery
                : editorRef.current?.getValue() ?? targetTab.query;

        let queryParts;
        try {
            const splitPreview = await splitSqlParts(queryToExecute);
            queryParts = splitPreview.parts;
        } catch (error) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                executeError: getErrorMessage(error),
                isExecuting: false,
                loadingMessage: null,
            }));
            return;
        }

        if (queryParts.length === 0) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                executeError: "No executable queries found.",
                isExecuting: false,
                loadingMessage: null,
            }));
            return;
        }

        updateTab(targetTab.id, (tab) => ({
            ...tab,
            isExecuting: true,
            loadingMessage: "Running query...",
            resultLayout: "grid",
            executeError: null,
        }));

        if (queryParts.length === 1 && isUpdateQuery(queryParts[0].sql)) {
            try {
                const preview = await prepareUpdateSql(queryParts[0].sql);
                if (!preview.success) {
                    updateTab(targetTab.id, (tab) => ({
                        ...tab,
                        resultLayout: "grid",
                        executeError: preview.message || "Update preview failed",
                        isExecuting: false,
                        loadingMessage: null,
                    }));
                    return;
                }

                setDataChangeConfirm({
                    open: true,
                    count: preview.count,
                    token: preview.token,
                    tabId: targetTab.id,
                    isLoading: false,
                    action: "update",
                    requestParameterStatuses: buildRequestParameterStatuses(settings),
                });

                updateTab(targetTab.id, (tab) => ({
                    ...tab,
                    resultLayout: "grid",
                    isExecuting: false,
                    loadingMessage: null,
                }));
            } catch (error) {
                updateTab(targetTab.id, (tab) => ({
                    ...tab,
                    resultLayout: "grid",
                    executeError: getErrorMessage(error),
                    isExecuting: false,
                    loadingMessage: null,
                }));
            }
            return;
        }

        if (queryParts.length === 1 && isDeleteQuery(queryParts[0].sql)) {
            try {
                const preview = await prepareDeleteSql(queryParts[0].sql);
                if (!preview.success) {
                    updateTab(targetTab.id, (tab) => ({
                        ...tab,
                        resultLayout: "grid",
                        executeError: preview.message || "Delete preview failed",
                        isExecuting: false,
                        loadingMessage: null,
                    }));
                    return;
                }

                setDataChangeConfirm({
                    open: true,
                    count: preview.count,
                    token: preview.token,
                    tabId: targetTab.id,
                    isLoading: false,
                    action: "delete",
                    requestParameterStatuses: buildRequestParameterStatuses(settings),
                });

                updateTab(targetTab.id, (tab) => ({
                    ...tab,
                    resultLayout: "grid",
                    isExecuting: false,
                    loadingMessage: null,
                }));
            } catch (error) {
                updateTab(targetTab.id, (tab) => ({
                    ...tab,
                    resultLayout: "grid",
                    executeError: getErrorMessage(error),
                    isExecuting: false,
                    loadingMessage: null,
                }));
            }
            return;
        }

        try {
            if (
                queryParts.length > 1 &&
                queryParts.some(
                    (part) => isUpdateQuery(part.sql) || isDeleteQuery(part.sql)
                )
            ) {
                throw new Error(
                    "Multiple update/delete statements are not supported in one editor tab yet."
                );
            }

            const paneSeeds = queryParts.map((part) =>
                createQueryResultPane(
                    queryParts.length === 1
                        ? PRIMARY_RESULT_PANE_ID
                        : `part-${part.index}`,
                    queryParts.length === 1 ? "Results" : `Query ${part.index}`,
                    part.sql
                )
            );

            updateTab(targetTab.id, (tab) => {
                const [primaryPane, ...extraPanes] = paneSeeds;
                const multiPaneSeeds =
                    queryParts.length === 1
                        ? extraPanes
                        : paneSeeds.map((pane) => ({
                              ...pane,
                              isExecuting: true,
                              resultLayout: "details" as const,
                              results: [
                                  {
                                      attributes: {
                                          status: "queued",
                                          processed: 0,
                                          total: 0,
                                          progressPercent: 0,
                                          message: "Queuing queries...",
                                      },
                                  },
                              ],
                              loadingMessage: "Queuing queries...",
                          }));
                return applyPrimaryResultPane(
                    {
                        ...tab,
                        extraResultPanes: multiPaneSeeds,
                    },
                    {
                        ...primaryPane,
                        isExecuting: true,
                        resultLayout: "details",
                        results: [
                            {
                                attributes: {
                                    status: "queued",
                                    processed: 0,
                                    total: 0,
                                    progressPercent: 0,
                                    message: "Queuing queries...",
                                },
                            },
                        ],
                        loadingMessage: "Queuing queries...",
                    },
                    {
                        extraResultPanes: multiPaneSeeds,
                        isExecuting: true,
                        loadingMessage: "Queuing queries...",
                    }
                );
            });

            await Promise.all(
                queryParts.map(async (part) => {
                    const paneId =
                        queryParts.length === 1
                            ? PRIMARY_RESULT_PANE_ID
                            : `part-${part.index}`;
                    const response = await executeSql(part.sql);

                    updateResultPane(targetTab.id, paneId, (pane) => ({
                        ...pane,
                        results: [
                            {
                                attributes: {
                                    status: "queued",
                                    processed: 0,
                                    total: 0,
                                    progressPercent: 0,
                                    message: response.message,
                                },
                            },
                        ],
                        resultLayout: "details",
                        queryMetadata: null,
                        executeError: null,
                        isExecuting: true,
                        loadingMessage: response.message,
                        currentJobId: response.jobId,
                    }));
                    startBackgroundJobPolling(
                        "select",
                        response.jobId,
                        targetTab.id,
                        paneId
                    );
                })
            );
        } catch (error) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                results: [],
                resultLayout: "grid",
                executeError: getErrorMessage(error),
                queryMetadata: null,
                isExecuting: false,
                loadingMessage: null,
                currentJobId: null,
                extraResultPanes: [],
            }));
        }
    };

    const handlePreviewActiveTab = async () => {
        if (activeTabId === 0) return;
        const targetTab = tabs.find((tab) => tab.id === activeTabId);
        if (!targetTab || targetTab.kind !== "query") return;

        try {
            const response = await previewFetchXml(targetTab.query);
            const formattedFetchXml = formatFetchXml(
                response.fetchXml,
                settings.fetchXmlSingleQuotes
            );
            try {
                await navigator.clipboard.writeText(formattedFetchXml);
                notifySuccess("FetchXML copied", "Preview copied to clipboard.");
            } catch (copyError) {
                notifyWarning(
                    "FetchXML preview ready",
                    "Could not copy to clipboard."
                );
            }
            const previewId = nextTabId.current++;
            const previewTitle = `FetchXML - ${targetTab.title}`;
            const previewTab = createFetchXmlTab(
                previewId,
                previewTitle,
                formattedFetchXml,
                targetTab.connectionId
            );
            setTabs((prev) => [...prev, previewTab]);
            setActiveTabId(previewId);
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                fetchPreview: null,
                previewError: null,
            }));
        } catch (error) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                fetchPreview: null,
                previewError: getErrorMessage(error),
            }));
        }
    };

    const handleCopyDeviceCodeValue = async (value: string | null | undefined) => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
            notifySuccess("Copied to clipboard");
        } catch (error) {
            logError("Failed to copy device code value", error, "queryverse::frontend::app");
            notifyError("Could not copy to clipboard.");
        }
    };

    const handleOpenSqlFile = async () => {
        try {
            const response = await openSqlFile();
            if (!response) return;

            const connectionName = selectedConnection?.name ?? "No connection";
            const newId = nextTabId.current++;
            const newTab = {
                ...createQueryTab(newId),
                title: `${response.fileName} - ${connectionName}`,
                query: response.contents,
                filePath: response.path,
                fileName: response.fileName,
                lastSavedQuery: response.contents,
                isEditorDirty: false,
                connectionId: selectedConnection?.id ?? null,
            };

            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newId);
        } catch (error) {
            logError("Failed to open SQL file", error, "queryverse::frontend::app");
        }
    };

    const handleSaveActiveTab = async () => {
        if (!activeTab || activeTab.kind !== "query") return;
        try {
            const editorContents =
                editorRef.current?.getValue() ?? activeTab.query;
            if (activeTab.filePath) {
                await saveSqlFile({
                    path: activeTab.filePath,
                    contents: editorContents,
                });
            }
            updateTab(activeTab.id, (tab) => ({
                ...tab,
                query: editorContents,
                lastSavedQuery: editorContents,
                isEditorDirty: false,
            }));
        } catch (error) {
            logError("Failed to save SQL file", error, "queryverse::frontend::app");
        }
    };

    const handleSaveActiveTabAs = async () => {
        if (!activeTab) return;
        try {
            const editorContents =
                editorRef.current?.getValue() ?? activeTab.query;
            const response = await saveSqlFileAs({
                contents: editorContents,
                fileName: activeTab.fileName ?? "query.sql",
            });
            if (!response) return;

            const connectionName = selectedConnection?.name ?? "No connection";
            updateTab(activeTab.id, (tab) => ({
                ...tab,
                filePath: response.path,
                fileName: response.fileName,
                title: `${response.fileName} - ${connectionName}`,
                query: editorContents,
                lastSavedQuery: editorContents,
                isEditorDirty: false,
            }));
        } catch (error) {
            logError("Failed to save SQL file as", error, "queryverse::frontend::app");
        }
    };

    const handleOpenSetConnection = (tabId: number) => {
        const targetTab = tabs.find((tab) => tab.id === tabId);
        if (!targetTab || targetTab.kind !== "query") {
            return;
        }
        setTabContextMenu((prev) => ({ ...prev, open: false }));
        setConnectionPickerTabId(tabId);
        setConnectionPickerOpen(true);
    };

    const handleSelectConnectionForTab = async (connection: Connection) => {
        if (connectionPickerTabId === null) return;
        const targetTabId = connectionPickerTabId;
        setConnectionPickerOpen(false);
        setConnectionPickerTabId(null);

        const connectionName = connection.name ?? "No connection";
        updateTab(targetTabId, (tab) => ({
            ...tab,
            connectionId: connection.id ?? null,
            title: tab.fileName
                ? `${tab.fileName} - ${connectionName}`
                : `Query - ${connectionName}`,
        }));
        setSelectedConnection(connection);
        if (connection.id) {
            await setConnection(connection.id);
            try {
                const response = await listEntityDefinitions();
                if (response.success) {
                    setEntityDefinitions(response.value);
                    setEntityAttributesByLogical({});
                    setEntityRelationshipsByLogical({});
                    setEntityAttributesLoading({});
                    setEntityAttributesError({});
                }
            } catch (error) {
                logError(
                    "Failed to load entity definitions",
                    error,
                    "queryverse::frontend::app"
                );
            }
        }
    };

    const handleLoadEntityMetadata = async (
        logicalName: string,
        source: "editor" | "schema" = "schema"
    ) => {
        if (!logicalName) return;
        const definition = getEntityDefinition(logicalName);
        const shouldAlsoLoadActivityPointer =
            Boolean(definition?.IsActivity) &&
            logicalName.toLowerCase() !== "activitypointer";

        const isEntityLoaded =
            entityAttributesByLogical[logicalName] &&
            entityRelationshipsByLogical[logicalName];
        const isActivityPointerLoaded =
            !shouldAlsoLoadActivityPointer ||
            (entityAttributesByLogical.activitypointer &&
                entityRelationshipsByLogical.activitypointer);

        if (isEntityLoaded && isActivityPointerLoaded) {
            return;
        }
        if (entityAttributesLoading[logicalName]) return;
        if (shouldAlsoLoadActivityPointer && entityAttributesLoading.activitypointer) return;

        setEntityAttributesLoading((prev) => ({ ...prev, [logicalName]: true }));
        if (shouldAlsoLoadActivityPointer) {
            setEntityAttributesLoading((prev) => ({ ...prev, activitypointer: true }));
        }
        setEntityAttributesError((prev) => ({ ...prev, [logicalName]: null }));
        if (shouldAlsoLoadActivityPointer) {
            setEntityAttributesError((prev) => ({ ...prev, activitypointer: null }));
        }

        try {
            const requests: Promise<any>[] = [
                listEntityAttributes(logicalName),
                listEntityRelationships(logicalName),
            ];
            if (shouldAlsoLoadActivityPointer) {
                requests.push(
                    listEntityAttributes("activitypointer"),
                    listEntityRelationships("activitypointer")
                );
            }

            const responses = await Promise.all(requests);
            const [attributesResponse, relationshipsResponse, activityAttributesResponse, activityRelationshipsResponse] =
                responses;
            if (
                attributesResponse.success &&
                relationshipsResponse.success &&
                (!shouldAlsoLoadActivityPointer ||
                    (activityAttributesResponse.success && activityRelationshipsResponse.success))
            ) {
                setEntityAttributesByLogical((prev) => ({
                    ...prev,
                    [logicalName]: attributesResponse.value,
                    ...(shouldAlsoLoadActivityPointer
                        ? { activitypointer: activityAttributesResponse.value }
                        : {}),
                }));
                setEntityRelationshipsByLogical((prev) => ({
                    ...prev,
                    [logicalName]: relationshipsResponse.value,
                    ...(shouldAlsoLoadActivityPointer
                        ? { activitypointer: activityRelationshipsResponse.value }
                        : {}),
                }));
            } else {
                const message =
                    attributesResponse.message ||
                    relationshipsResponse.message ||
                    activityAttributesResponse?.message ||
                    activityRelationshipsResponse?.message ||
                    "Failed to load entity metadata.";
                if (source === "editor" && activeTab?.kind === "query") {
                    updateTab(activeTab.id, (tab) => ({
                        ...tab,
                        executeError: message,
                    }));
                } else {
                    setEntityAttributesError((prev) => ({
                        ...prev,
                        [logicalName]: message,
                    }));
                }
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (source === "editor" && activeTab?.kind === "query") {
                updateTab(activeTab.id, (tab) => ({
                    ...tab,
                    executeError: message,
                }));
            } else {
                setEntityAttributesError((prev) => ({
                    ...prev,
                    [logicalName]: message,
                }));
            }
            if (shouldAlsoLoadActivityPointer) {
                if (source !== "editor") {
                    setEntityAttributesError((prev) => ({
                        ...prev,
                        activitypointer: message,
                    }));
                }
            }
        } finally {
            setEntityAttributesLoading((prev) => ({
                ...prev,
                [logicalName]: false,
                ...(shouldAlsoLoadActivityPointer ? { activitypointer: false } : {}),
            }));
        }
    };

    const handleOpenSchemaEntity = async (entity: EntityDefinition) => {
        const logicalName = entity.LogicalName;
        if (!logicalName) return;

        await handleLoadEntityMetadata(logicalName);

        const existingTab = tabs.find(
            (tab) => tab.kind === "schema" && tab.schemaLogicalName === logicalName
        );
        if (existingTab) {
            setActiveTabId(existingTab.id);
            setSchemaEnabled(false);
            return;
        }

        const displayName = getEntityDisplayName(entity);
        const newId = nextTabId.current++;
        const newTab = createSchemaTab(
            newId,
            `Schema - ${displayName}`,
            logicalName,
            displayName,
            selectedConnection?.id ?? null
        );

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newId);
        setSchemaEnabled(false);
    };

    const handleConfirmDataChange = async () => {
        if (!dataChangeConfirm.token || dataChangeConfirm.tabId === null) return;
        setDataChangeConfirm((prev) => ({ ...prev, isLoading: true }));
        updateTab(dataChangeConfirm.tabId, (tab) => ({
            ...tab,
            isExecuting: true,
            loadingMessage: "Queuing job...",
            currentJobId: null,
            resultLayout: "details",
            executeError: null,
            extraResultPanes: [],
        }));

        try {
            if (dataChangeConfirm.action === "delete") {
                const response = await executeDeleteSql(dataChangeConfirm.token);
                updateTab(dataChangeConfirm.tabId, (tab) => ({
                    ...tab,
                    results: [
                        {
                            attributes: {
                                status: "queued",
                                processed: 0,
                                total: dataChangeConfirm.count,
                                progressPercent: 0,
                                message: response.message,
                            },
                        },
                    ],
                    resultLayout: "details",
                    queryMetadata: null,
                    executeError: null,
                    isExecuting: true,
                    loadingMessage: response.message,
                    currentJobId: response.jobId,
                    extraResultPanes: [],
                }));
                startBackgroundJobPolling("delete", response.jobId, dataChangeConfirm.tabId);
                return;
            }

            const response = await executeUpdateSql(dataChangeConfirm.token);
            updateTab(dataChangeConfirm.tabId, (tab) => ({
                ...tab,
                results: [
                    {
                        attributes: {
                            status: "queued",
                            processed: 0,
                            total: dataChangeConfirm.count,
                            progressPercent: 0,
                            message: response.message,
                        },
                    },
                ],
                resultLayout: "details",
                queryMetadata: null,
                executeError: null,
                isExecuting: true,
                loadingMessage: response.message,
                currentJobId: response.jobId,
                extraResultPanes: [],
            }));
            startBackgroundJobPolling("update", response.jobId, dataChangeConfirm.tabId);
        } catch (error) {
            updateTab(dataChangeConfirm.tabId, (tab) => ({
                ...tab,
                resultLayout: "grid",
                executeError: getErrorMessage(error),
                isExecuting: false,
                loadingMessage: null,
                currentJobId: null,
                extraResultPanes: [],
            }));
        } finally {
            resetDataChangeConfirm();
        }
    };

    const handleCancelDataChange = async () => {
        if (dataChangeConfirm.token) {
            try {
                if (dataChangeConfirm.action === "delete") {
                    await discardDeleteSql(dataChangeConfirm.token);
                } else {
                    await discardUpdateSql(dataChangeConfirm.token);
                }
            } catch {
                // Ignore discard errors; the batch will expire server-side.
            }
        }
        resetDataChangeConfirm();
    };

    const handleCancelActiveTab = async () => {
        if (!activeTab || activeTab.kind !== "query") return;

        const runningJobIds = getAllResultPanes(activeTab)
            .map((pane) => pane.currentJobId)
            .filter((jobId): jobId is string => Boolean(jobId));

        if (runningJobIds.length === 0) return;

        try {
            await Promise.all(runningJobIds.map((jobId) => cancelBackgroundJob(jobId)));
            updateTab(activeTab.id, (tab) =>
                applyPrimaryResultPane(
                    {
                        ...tab,
                        extraResultPanes: tab.extraResultPanes.map((pane) => ({
                            ...pane,
                            loadingMessage: pane.currentJobId ? "Cancelling query..." : null,
                            executeError: null,
                        })),
                    },
                    {
                        ...getPrimaryResultPane(tab),
                        loadingMessage: runningJobIds.includes(tab.currentJobId ?? "")
                            ? "Cancelling query..."
                            : null,
                        executeError: null,
                    },
                    {
                        isExecuting: true,
                        loadingMessage: "Cancelling query...",
                    }
                )
            );
        } catch (error) {
            updateTab(activeTab.id, (tab) => ({
                ...tab,
                executeError: getErrorMessage(error),
            }));
        }
    };

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <AppToaster />
                <MenuBar
                    connectionsEnabled={connectionsEnabled}
                    schemaEnabled={schemaEnabled}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onToggleConnections={() => {
                        const next = !connectionsEnabled;
                        setIsMenuOpen(next);
                        if (next) {
                            setSchemaEnabled(false);
                        }
                    }}
                    onToggleSchema={() => {
                        const next = !schemaEnabled;
                        setSchemaEnabled(next);
                        if (next) {
                            setIsMenuOpen(false);
                        }
                    }}
                    onExecuteSql={handleExecuteActiveTab}
                    onCancelSql={handleCancelActiveTab}
                    onPreviewFetchXml={handlePreviewActiveTab}
                    canExecute={Boolean(
                        selectedConnection?.id &&
                            activeTab?.kind === "query" &&
                            !activeTab?.isEditorDirty &&
                            !activeTab?.isExecuting
                    )}
                    isExecuting={Boolean(activeTab?.kind === "query" && activeTab?.isExecuting)}
                    canPreview={Boolean(activeTab?.kind === "query")}
                    onOpenSqlFile={handleOpenSqlFile}
                    onSaveSqlFile={handleSaveActiveTab}
                    canSaveSqlFile={Boolean(activeTab?.kind === "query")}
                    onSaveSqlFileAs={handleSaveActiveTabAs}
                    currentConnection={selectedConnection}
                />
                <ShortcutManager
                    handlers={{
                        execute: handleExecuteActiveTab,
                        "close-tab": handleCloseActiveTab,
                        "new-tab": handleAddTabWithFirstConnection,
                        "save-file": handleSaveActiveTab,
                    }}
                    isEnabled={(id: ShortcutActionId) => {
                        if (!keyBindingsEnabled) return false;
                        return id === "execute"
                            ? Boolean(
                                  selectedConnection?.id &&
                                      activeTab?.kind === "query" &&
                                      !activeTab?.isEditorDirty &&
                                      !activeTab?.isExecuting
                              )
                            : id === "save-file"
                            ? Boolean(activeTab?.kind === "query")
                            : true;
                    }}
                />
                <SettingsModal
                    open={settingsOpen}
                    settings={settings}
                    isSaving={settingsSaving}
                    onClose={() => setSettingsOpen(false)}
                    onSave={async (nextSettings) => {
                        await persistSettings(nextSettings);
                        setSettingsOpen(false);
                    }}
                />
                <ModalDialog
                    open={deviceCodeModal.open}
                    title="Device Code Sign-In"
                    onClose={() => setDeviceCodeModal((prev) => ({ ...prev, open: false }))}
                    closeLabel="Hide"
                    width="460px"
                >
                    <div className={styles.deviceCodeModal}>
                        <div className={styles.deviceCodeRow}>
                            <Text weight="semibold">Open this URL</Text>
                            <div className={styles.deviceCodeBlock}>
                                {deviceCodeModal.verificationUriComplete ??
                                    deviceCodeModal.verificationUri}
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<Copy24Regular />}
                                    className={styles.deviceCodeCopyButton}
                                    onClick={() =>
                                        void handleCopyDeviceCodeValue(
                                            deviceCodeModal.verificationUriComplete ??
                                                deviceCodeModal.verificationUri
                                        )
                                    }
                                    aria-label="Copy URL"
                                    title="Copy URL"
                                />
                            </div>
                        </div>
                        <div className={styles.deviceCodeRow}>
                            <Text weight="semibold">Enter this code</Text>
                            <div className={styles.deviceCodeBlock}>
                                {deviceCodeModal.userCode}
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<Copy24Regular />}
                                    className={styles.deviceCodeCopyButton}
                                    onClick={() =>
                                        void handleCopyDeviceCodeValue(deviceCodeModal.userCode)
                                    }
                                    aria-label="Copy code"
                                    title="Copy code"
                                />
                            </div>
                        </div>
                        <Text>
                            {deviceCodeModal.message ||
                                "Complete sign-in in the browser. QueryVerse will continue automatically."}
                        </Text>
                    </div>
                </ModalDialog>
                <ModalDialog
                    open={connectionPickerOpen}
                    title="Set Connection"
                    onClose={() => {
                        setConnectionPickerOpen(false);
                        setConnectionPickerTabId(null);
                    }}
                    closeLabel="Cancel"
                    width="300px"
                >
                    <div className={styles.connectionPickerModal}>
                        <div className={styles.connectionPicker}>
                        {connectionPickerLoading ? (
                            <div>Loading connections...</div>
                        ) : connectionPickerError ? (
                            <div>{connectionPickerError}</div>
                        ) : connectionTreeOptions.length === 0 ? (
                            <div>No connections available.</div>
                        ) : (
                            <ConnectionTreeList
                                items={connectionTreeOptions}
                                onConnectionSelect={handleSelectConnectionForTab}
                            />
                        )}
                        </div>
                    </div>
                </ModalDialog>
                <DataChangeConfirmModal
                    open={dataChangeConfirm.open}
                    count={dataChangeConfirm.count}
                    isLoading={dataChangeConfirm.isLoading}
                    action={dataChangeConfirm.action}
                    requestParameterStatuses={dataChangeConfirm.requestParameterStatuses}
                    onConfirm={handleConfirmDataChange}
                    onCancel={handleCancelDataChange}
                />
                <TabSwitcher
                    tabs={tabs.map(({ id, title }) => ({ id, title }))}
                    activeTabId={activeTabId}
                    onTabSelect={setActiveTabId}
                />

                <div className={styles.wrapper}>
                    <ConnectionsMenu
                        isOpen={connectionsEnabled}
                        onOpenConnection={async (connection) => {
                            openTab(connection);
                            setSelectedConnection(connection);

                            if (!connection.id) {
                                setIsMenuOpen(false);
                                return;
                            }

                            await setConnection(connection.id);

                            const response = await listEntityDefinitions();
                            //TODO: handle failure here
                            setEntityDefinitions(response.value);
                            setEntityAttributesByLogical({});
                            setEntityRelationshipsByLogical({});
                            setEntityAttributesLoading({});
                            setEntityAttributesError({});

                            setIsMenuOpen(false);
                        }}
                    />
                    <SchemaExplorerMenu
                        isOpen={schemaEnabled}
                        entityDefinitions={entityDefinitions}
                        onOpenEntity={handleOpenSchemaEntity}
                    />

                    <div className={contentClasses}>
                        <div
                            ref={queryPaneRef}
                            className={styles.queryPane}
                        >
                        <div
                            className={styles.top}
                            style={
                                activeTab && activeTab.kind === "query"
                                    ? {
                                          flex: "0 0 auto",
                                          height: `calc(100% - ${resultsPaneHeight}px - 12px)`,
                                      }
                                    : undefined
                            }
                        >
                            <div className={styles.tabsBar}>
                                <TabList
                                    className={styles.tabsList}
                                    selectedValue={activeTabId}
                                    onTabSelect={(_, data) => {
                                        if (typeof data.value === "number") {
                                            setActiveTabId(data.value);
                                        }
                                    }}
                                >
                                    {tabs.map((tab) => (
                                        <Tab
                                            key={tab.id}
                                            value={tab.id}
                                            onContextMenu={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setActiveTabId(tab.id);
                                                setTabContextMenu({
                                                    open: true,
                                                    x: event.clientX,
                                                    y: event.clientY,
                                                    tabId: tab.id,
                                                });
                                            }}
                                        >
                                            <span className={styles.tabLabel}>
                                                <span>{tab.title}</span>
                                                <span
                                                    className={combineClasses(
                                                        styles.tabClose,
                                                        tab.isEditorDirty && styles.tabCloseDirty
                                                    )}
                                                    role="button"
                                                    aria-label={`Close ${tab.title}`}
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        handleCloseTab(tab.id);
                                                    }}
                                                >
                                                    ×
                                                </span>
                                            </span>
                                        </Tab>
                                    ))}
                                </TabList>
                                <Button
                                    className={styles.addTabButton}
                                    icon={<Add24Regular />}
                                    appearance="subtle"
                                    onClick={handleAddTab}
                                    title="New Tab"
                                />
                            </div>
                            {activeTab && activeTab.kind === "schema" ? (
                                <SchemaEntityView
                                    title={
                                        activeTab.schemaDisplayName ??
                                        activeTab.schemaLogicalName ??
                                        activeTab.title
                                    }
                                    logicalName={activeTab.schemaLogicalName ?? ""}
                                    attributes={
                                        activeTab.schemaLogicalName
                                            ? entityAttributesByLogical[
                                                  activeTab.schemaLogicalName
                                              ]
                                            : undefined
                                    }
                                    relationships={
                                        activeTab.schemaLogicalName
                                            ? entityRelationshipsByLogical[
                                                  activeTab.schemaLogicalName
                                              ]
                                            : undefined
                                    }
                                    isLoading={Boolean(
                                        activeTab.schemaLogicalName &&
                                            entityAttributesLoading[
                                                activeTab.schemaLogicalName
                                            ]
                                    )}
                                    error={
                                        activeTab.schemaLogicalName
                                            ? entityAttributesError[
                                                  activeTab.schemaLogicalName
                                              ]
                                            : null
                                    }
                                />
                            ) : (
                                <CustomEditor
                                    ref={editorRef}
                                    key={`${activeTab?.kind}-${activeTab?.id}`}
                                    vimEnabled={vimEnabled && activeTab?.kind === "query"}
                                    value={activeTab?.query ?? ""}
                                    language={activeTab?.kind === "fetchxml" ? "xml" : "sql"}
                                    readOnly={activeTab?.kind === "fetchxml"}
                                    fontSize={editorFontSize}
                                    entityDefinitions={
                                        activeTab?.kind === "query" ? entityDefinitions : []
                                    }
                                    entityAttributes={entityAttributesByLogical}
                                    entityRelationships={entityRelationshipsByLogical}
                                    onEntitySelected={(logicalName) => {
                                        handleLoadEntityMetadata(logicalName, "editor");
                                    }}
                                    onEntitiesSelected={(logicalNames) => {
                                        logicalNames.forEach((name) => {
                                            handleLoadEntityMetadata(name, "editor");
                                        });
                                    }}
                                    onChange={() => {
                                        if (activeTab?.kind !== "query") return;
                                        if (activeTab.isEditorDirty) return;
                                        updateTab(activeTab.id, (tab) =>
                                            tab.isEditorDirty
                                                ? tab
                                                : { ...tab, isEditorDirty: true }
                                        );
                                    }}
                                />
                            )}
                        </div>

                        {activeTab && activeTab.kind === "query" ? (
                            <>
                            <div
                                className={styles.resultsResizeHandle}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    setIsResizingResultsPane(true);
                                }}
                                title="Drag to resize results"
                            />
                            <div
                                className={styles.bottom}
                                style={{ height: `${resultsPaneHeight}px` }}
                            >
                                <div className={styles.resultsPanelsViewport}>
                                    <div
                                        className={styles.resultsPanelsStrip}
                                        style={{
                                            minWidth:
                                                activeResultPanes.length <= 2
                                                    ? "100%"
                                                    : "max-content",
                                        }}
                                    >
                                        {activeResultPanes.map((pane) => (
                                            <div
                                                key={pane.id}
                                                className={styles.resultsPanel}
                                                style={{
                                                    flex:
                                                        activeResultPanes.length <= 2
                                                            ? "1 1 0"
                                                            : "0 0 min(720px, 100%)",
                                                }}
                                            >
                                                <div className={styles.resultsPanelHeader}>
                                                    {pane.title}
                                                </div>
                                                <div className={styles.resultsPanelBody}>
                                                    <ResultsWindow
                                                        data={pane.results}
                                                        entityDefinitions={entityDefinitions}
                                                        query={pane.query}
                                                        queryMetadata={pane.queryMetadata}
                                                        isLoading={pane.isExecuting}
                                                        loadingMessage={
                                                            pane.loadingMessage ?? undefined
                                                        }
                                                        layout={pane.resultLayout}
                                                        errorMessage={pane.executeError}
                                                        dataverseUrl={
                                                            selectedConnection?.auth.dataverseUrl
                                                        }
                                                        exportJobId={pane.currentJobId}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            </>
                        ) : null}
                        </div>
                    </div>
                </div>
                {tabContextMenu.open && tabContextMenu.tabId !== null ? (
                        <div
                            ref={tabContextMenuRef}
                            className={styles.tabContextMenu}
                            style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
                            role="menu"
                        >
                            <button
                                className={styles.tabContextMenuItem}
                                type="button"
                                onClick={() => handleOpenSetConnection(tabContextMenu.tabId as number)}
                            >
                            Set connection
                        </button>
                    </div>
                ) : null}
            </div>
        </FluentProvider>
    );
}
