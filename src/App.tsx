import { useEffect, useRef, useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    TabList,
    Tab,
    Button,
} from "@fluentui/react-components";
import { Add24Regular, Link24Filled } from "@fluentui/react-icons";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";
import { ShortcutManager } from "./components/ShortcutManager";
import { ModalDialog } from "./components/ModalDialog";
import { SettingsModal } from "./components/SettingsModal";
import { TabSwitcher } from "./components/TabSwitcher";
import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
import { SchemaExplorerMenu } from "./components/SchemaExplorerMenu";
import { combineClasses } from "./utility/class";
import { ResultRow } from "./binding/model/ResultRow";
import { FetchXmlPreview } from "./binding/model/FetchXmlPreview";
import { Connection } from "./binding/model/Connection";
import { FetchXmlPreview as FetchXmlPreviewPanel } from "./components/FetchXmlPreview";
import {
    executeSql,
    getSettings,
    getLaunchContext,
    listConnections,
    listEntityDefinitions,
    openSqlFile,
    openSqlFilePath,
    previewFetchXml,
    saveSqlFile,
    saveSqlFileAs,
    saveSettings,
    setConnection,
} from "./binding/function";
import { ShortcutActionId } from "./settings/shortcuts";
import { useAppStyles } from "./styles/AppStyles";
import { EntityDefinition } from "./binding/model/EntityDefinition";
import { SqlQueryMetadata } from "./binding/model/SqlQueryMetadata";
import { DEFAULT_SETTINGS, Settings } from "./binding/model/Settings";

const DEFAULT_QUERY = "select top 20 *\nfrom account";
// Debouncing editor updates avoids per-keystroke app state writes and UI lag.
const EDITOR_DEBOUNCE_MS = 200;

type EditorTab = {
    kind: "query" | "fetchxml";
    id: number;
    title: string;
    query: string;
    filePath: string | null;
    fileName: string | null;
    lastSavedQuery: string;
    isDirty: boolean;
    results: ResultRow[];
    connectionId: string | null;
    fetchPreview: FetchXmlPreview | null;
    previewError: string | null;
    executeError: string | null;
    isExecuting: boolean;
    queryMetadata: SqlQueryMetadata | null;
};

const createQueryTab = (id: number): EditorTab => ({
    kind: "query",
    id,
    title: `Query ${id}`,
    query: DEFAULT_QUERY,
    filePath: null,
    fileName: null,
    lastSavedQuery: DEFAULT_QUERY,
    isDirty: false,
    results: [],
    connectionId: null,
    fetchPreview: null,
    previewError: null,
    executeError: null,
    isExecuting: false,
    queryMetadata: null,
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
    isDirty: false,
    results: [],
    connectionId,
    fetchPreview: null,
    previewError: null,
    executeError: null,
    isExecuting: false,
    queryMetadata: null,
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
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
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
    const [connectionOptions, setConnectionOptions] = useState<Connection[]>([]);

    const [entityDefinitions, setEntityDefinitions] = useState<EntityDefinition[]>([]);

    const styles = useAppStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        (connectionsEnabled || schemaEnabled) && styles.contentShifted
    );

    const vimEnabled = settings.vimEnabled;
    const keyBindingsEnabled = settings.keyBindingsEnabled;

    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            try {
                const response = await getSettings();
                if (!cancelled && response.success) {
                    setSettings(response.value);
                }
            } catch (error) {
                console.error("Failed to load settings", error);
            }
        };

        loadSettings();

        return () => {
            cancelled = true;
        };
    }, []);

    const persistSettings = async (nextSettings: Settings) => {
        setSettings(nextSettings);
        setSettingsSaving(true);
        try {
            const response = await saveSettings(nextSettings);
            if (response.success) {
                setSettings(response.value);
            }
        } catch (error) {
            console.error("Failed to save settings", error);
        } finally {
            setSettingsSaving(false);
        }
    };

    const updateTab = (tabId: number, updater: (tab: EditorTab) => EditorTab) => {
        setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? updater(tab) : tab))
        );
    };

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
                const response = await listConnections();
                if (response.success) {
                    setConnectionOptions(response.value);
                } else {
                    setConnectionOptions([]);
                    setConnectionPickerError(response.message || "Failed to load connections.");
                }
            } catch (error) {
                setConnectionOptions([]);
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

    const formatFetchXml = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(trimmed, "application/xml");
            if (doc.getElementsByTagName("parsererror").length > 0) {
                return trimmed;
            }
            const serialized = new XMLSerializer().serializeToString(doc);
            return prettyPrintXml(serialized);
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
                                }
                            }
                        }
                    }
                }

                if (context.sqlFilePath) {
                    const file = await openSqlFilePath(context.sqlFilePath);
                    const connectionName = connectionToUse?.name ?? "No connection";
                    const newId = nextTabId.current++;
                    const newTab = {
                        ...createQueryTab(newId),
                        title: `${file.fileName} - ${connectionName}`,
                        query: file.contents,
                        filePath: file.path,
                        fileName: file.fileName,
                        lastSavedQuery: file.contents,
                        isDirty: false,
                        connectionId: connectionToUse?.id ?? null,
                    };

                    setTabs((prev) => [...prev, newTab]);
                    setActiveTabId(newId);
                }
            } catch (error) {
                console.error("Failed to initialize from CLI args", error);
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

        updateTab(targetTab.id, (tab) => ({
            ...tab,
            isExecuting: true,
            executeError: null,
        }));

        try {
            const response = await executeSql(targetTab.query);
            if (!response.success) {
                updateTab(targetTab.id, (tab) => ({
                    ...tab,
                    results: [],
                    queryMetadata: null,
                    executeError: response.message || "Query failed",
                    isExecuting: false,
                }));
                return;
            }

            updateTab(targetTab.id, (tab) => ({
                ...tab,
                results: response.value,
                queryMetadata: response.metadata ?? null,
                executeError: null,
                isExecuting: false,
            }));
        } catch (error) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                results: [],
                executeError: getErrorMessage(error),
                queryMetadata: null,
                isExecuting: false,
            }));
        }
    };

    const handlePreviewActiveTab = async () => {
        if (activeTabId === 0) return;
        const targetTab = tabs.find((tab) => tab.id === activeTabId);
        if (!targetTab || targetTab.kind !== "query") return;

        try {
            const response = await previewFetchXml(targetTab.query);
            const formattedFetchXml = formatFetchXml(response.fetchXml);
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

    const handleClearPreview = () => {
        if (!activeTab) return;
        updateTab(activeTab.id, (tab) => ({
            ...tab,
            fetchPreview: null,
            previewError: null,
        }));
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
                isDirty: false,
                connectionId: selectedConnection?.id ?? null,
            };

            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newId);
        } catch (error) {
            console.error("Failed to open SQL file", error);
        }
    };

    const handleSaveActiveTab = async () => {
        if (!activeTab?.filePath) return;
        try {
            await saveSqlFile({
                path: activeTab.filePath,
                contents: activeTab.query,
            });
            updateTab(activeTab.id, (tab) => ({
                ...tab,
                lastSavedQuery: tab.query,
                isDirty: false,
            }));
        } catch (error) {
            console.error("Failed to save SQL file", error);
        }
    };

    const handleSaveActiveTabAs = async () => {
        if (!activeTab) return;
        try {
            const response = await saveSqlFileAs({
                contents: activeTab.query,
                fileName: activeTab.fileName ?? "query.sql",
            });
            if (!response) return;

            const connectionName = selectedConnection?.name ?? "No connection";
            updateTab(activeTab.id, (tab) => ({
                ...tab,
                filePath: response.path,
                fileName: response.fileName,
                title: `${response.fileName} - ${connectionName}`,
                lastSavedQuery: tab.query,
                isDirty: false,
            }));
        } catch (error) {
            console.error("Failed to save SQL file as", error);
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
                }
            } catch (error) {
                console.error("Failed to load entity definitions", error);
            }
        }
    };

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
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
                    onPreviewFetchXml={handlePreviewActiveTab}
                    canExecute={Boolean(selectedConnection?.id && activeTab?.kind === "query")}
                    canPreview={Boolean(activeTab?.kind === "query")}
                    onOpenSqlFile={handleOpenSqlFile}
                    onSaveSqlFile={handleSaveActiveTab}
                    canSaveSqlFile={Boolean(activeTab?.filePath)}
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
                            ? Boolean(selectedConnection?.id && activeTab?.kind === "query")
                            : id === "save-file"
                            ? Boolean(activeTab?.filePath)
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
                        ) : connectionOptions.length === 0 ? (
                            <div>No connections available.</div>
                        ) : (
                            connectionOptions.map((connection) => (
                                <Button
                                    key={connection.id ?? connection.name}
                                    appearance="subtle"
                                    icon={<Link24Filled className={styles.connectionPickerIcon} />}
                                    className={styles.connectionPickerItem}
                                    onClick={() => {
                                        handleSelectConnectionForTab(connection);
                                    }}
                                >
                                    {connection.name ?? "Unnamed connection"}
                                </Button>
                            ))
                        )}
                        </div>
                    </div>
                </ModalDialog>
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

                            setIsMenuOpen(false);
                        }}
                    />
                    <SchemaExplorerMenu
                        isOpen={schemaEnabled}
                        entityDefinitions={entityDefinitions}
                    />

                    <div className={contentClasses}>
                        <div className={styles.top}>
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
                                                        tab.isDirty && styles.tabCloseDirty
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
                            {activeTab ? (
                                <CustomEditor
                                    key={`${activeTab.kind}-${activeTab.id}`}
                                    vimEnabled={vimEnabled && activeTab.kind === "query"}
                                    value={activeTab.query}
                                    language={activeTab.kind === "fetchxml" ? "xml" : "sql"}
                                    readOnly={activeTab.kind === "fetchxml"}
                                    debounceMs={EDITOR_DEBOUNCE_MS}
                                    onChange={(value) => {
                                        if (activeTab.kind !== "query") return;
                                        updateTab(activeTab.id, (tab) => ({
                                            ...tab,
                                            query: value,
                                            isDirty: value !== tab.lastSavedQuery,
                                        }));
                                    }}
                                />
                            ) : null}
                        </div>

                        <div className={styles.bottom}>
                            {activeTab && activeTab.kind === "query" ? (
                                <>
                                    <FetchXmlPreviewPanel
                                        fetchPreview={activeTab.fetchPreview}
                                        previewError={activeTab.previewError}
                                        onClear={handleClearPreview}
                                    />
                                    <ResultsWindow
                                        data={activeTab.results}
                                        entityDefinitions={entityDefinitions}
                                        query={activeTab.query}
                                        queryMetadata={activeTab.queryMetadata}
                                        isLoading={activeTab.isExecuting}
                                        errorMessage={activeTab.executeError}
                                    />
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
