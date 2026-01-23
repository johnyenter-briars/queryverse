import { useRef, useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    TabList,
    Tab,
    Button,
} from "@fluentui/react-components";
import { Add24Regular } from "@fluentui/react-icons";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";
import { ShortcutManager } from "./components/ShortcutManager";
import { ModalDialog } from "./components/ModalDialog";
import { TabSwitcher } from "./components/TabSwitcher";
import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
import { SchemaExplorerMenu } from "./components/SchemaExplorerMenu";
import { combineClasses } from "./utility/class";
import { Entity } from "./binding/model/Entity";
import { FetchXmlPreview } from "./binding/model/FetchXmlPreview";
import { FetchXmlPreview as FetchXmlPreviewPanel } from "./components/FetchXmlPreview";
import { executeSql, previewFetchXml } from "./binding/function";
import { SHORTCUTS, ShortcutActionId } from "./settings/shortcuts";
import { useAppStyles } from "./styles/AppStyles";

const DEFAULT_QUERY = "select top 20 *\nfrom account";

type EditorTab = {
    id: number;
    title: string;
    query: string;
    results: Entity[];
    connectionId: string | null;
    fetchPreview: FetchXmlPreview | null;
    previewError: string | null;
    executeError: string | null;
};

const createTab = (id: number): EditorTab => ({
    id,
    title: `Query ${id}`,
    query: DEFAULT_QUERY,
    results: [],
    connectionId: null,
    fetchPreview: null,
    previewError: null,
    executeError: null,
});

export default function App() {
    const [connectionsEnabled, setIsMenuOpen] = useState(true);
    const [schemaEnabled, setSchemaEnabled] = useState(false);
    const [vimEnabled, setVimEnabled] = useState(true);
    const [tabs, setTabs] = useState<EditorTab[]>([createTab(1)]);
    const [activeTabId, setActiveTabId] = useState(1);
    const nextTabId = useRef(2);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const styles = useAppStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        (connectionsEnabled || schemaEnabled) && styles.contentShifted
    );

    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    const updateTab = (tabId: number, updater: (tab: EditorTab) => EditorTab) => {
        setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? updater(tab) : tab))
        );
    };

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === "string") return error;
        return "Unknown error";
    };

    const handleAddTab = () => {
        const newId = nextTabId.current++;
        const newTab = createTab(newId);

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newId);
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
        if (!targetTab?.connectionId) {
            return;
        }

        try {
            const response = await executeSql(targetTab.query, targetTab.connectionId);
            if (!response.success) {
                updateTab(targetTab.id, (tab) => ({
                    ...tab,
                    results: response.value,
                    executeError: response.message || "Query failed",
                }));
                return;
            }

            updateTab(targetTab.id, (tab) => ({
                ...tab,
                results: response.value,
                executeError: null,
            }));
        } catch (error) {
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                executeError: getErrorMessage(error),
            }));
        }
    };

    const handlePreviewActiveTab = async () => {
        if (activeTabId === 0) return;
        const targetTab = tabs.find((tab) => tab.id === activeTabId);
        if (!targetTab) return;

        try {
            const response = await previewFetchXml(targetTab.query);
            updateTab(targetTab.id, (tab) => ({
                ...tab,
                fetchPreview: response,
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

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <MenuBar
                    vimEnabled={vimEnabled}
                    connectionsEnabled={connectionsEnabled}
                    schemaEnabled={schemaEnabled}
                    onToggleVimEnabled={() => setVimEnabled(!vimEnabled)}
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
                    canExecute={Boolean(activeTab?.connectionId)}
                    onShowShortcuts={() => setShortcutsOpen(true)}
                />
                <ShortcutManager
                    handlers={{
                        execute: handleExecuteActiveTab,
                        "close-tab": handleCloseActiveTab,
                        "new-tab": handleAddTab,
                    }}
                    isEnabled={(id: ShortcutActionId) =>
                        id === "execute" ? Boolean(activeTab?.connectionId) : true
                    }
                />
                <ModalDialog
                    open={shortcutsOpen}
                    title="Keyboard Shortcuts"
                    onClose={() => setShortcutsOpen(false)}
                >
                    <div>
                        {SHORTCUTS.map((shortcut) => (
                            <div key={shortcut.id}>
                                {shortcut.keyLabel} - {shortcut.label}
                            </div>
                        ))}
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
                        onOpenConnection={(connection) => {
                            const newId = nextTabId.current++;
                            const newTab = {
                                ...createTab(newId),
                                title: `Query - ${connection.name}`,
                                connectionId: connection.id ?? null,
                            };
                            setTabs((prev) => [...prev, newTab]);
                            setActiveTabId(newId);
                        }}
                    />
                    <SchemaExplorerMenu isOpen={schemaEnabled} />

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
                                        <Tab key={tab.id} value={tab.id}>
                                            <span className={styles.tabLabel}>
                                                <span>{tab.title}</span>
                                                <span
                                                    className={styles.tabClose}
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
                                    vimEnabled={vimEnabled}
                                    value={activeTab.query}
                                    onChange={(value) => {
                                        updateTab(activeTab.id, (tab) => ({
                                            ...tab,
                                            query: value,
                                        }));
                                    }}
                                />
                            ) : null}
                        </div>

                        <div className={styles.bottom}>
                            {activeTab ? (
                                <>
                                    <FetchXmlPreviewPanel
                                        fetchPreview={activeTab.fetchPreview}
                                        previewError={activeTab.previewError}
                                        onClear={handleClearPreview}
                                    />
                                    {activeTab.executeError && (
                                        <div className={styles.executeError}>
                                            {activeTab.executeError}
                                        </div>
                                    )}
                                    <ResultsWindow data={activeTab.results} />
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}
