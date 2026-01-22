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
import { MultipleResponse } from "./binding/model/MultipleResponse";
import { Entity } from "./binding/model/Entity";
import { retrieveMultiple } from "./binding/backend";
import { SHORTCUTS, ShortcutActionId } from "./settings/shortcuts";
import { useAppStyles } from "./styles/AppStyles";

type EditorTab = {
    id: number;
    title: string;
    query: string;
    results: Entity[];
    connectionId: string | null;
};

export default function App() {
    const [connectionsEnabled, setIsMenuOpen] = useState(true); 
    const [schemaEnabled, setSchemaEnabled] = useState(false); 
    const [vimEnabled, setVimEnabled] = useState(true); 
    const [tabs, setTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = useState(0);
    const nextTabId = useRef(1);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const styles = useAppStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        (connectionsEnabled || schemaEnabled) && styles.contentShifted
    );

    const onRetrieveResults = (results: MultipleResponse<Entity>) =>  {
        if (!results.success) {
            console.log("Fail") //TODO
            return;
        }

        if (activeTabId === 0) {
            return;
        }

        setTabs((prev) =>
            prev.map((tab) =>
                tab.id === activeTabId ? { ...tab, results: results.value } : tab
            )
        );
    }

    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    const handleAddTab = () => {
        const newId = nextTabId.current++;
        const newTab: EditorTab = {
            id: newId,
            title: `Query ${newId}`,
            query: "",
            results: [],
            connectionId: null,
        };

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
        if (!activeTab?.connectionId) {
            console.error("No connection assigned to this tab.");
            return;
        }
        const response = await retrieveMultiple(activeTab.connectionId);
        onRetrieveResults(response);
    };


    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <MenuBar
                    vimEnabled={vimEnabled}
					connectionsEnabled={connectionsEnabled}
                    onToggleVimEnabled={() => setVimEnabled(!vimEnabled)} 
                    onToggleConnections={() => {
                        const next = !connectionsEnabled;
                        setIsMenuOpen(next);
                        if (next) {
                            setSchemaEnabled(false);
                        }
                    }} 
                    schemaEnabled={schemaEnabled}
                    onToggleSchema={() => {
                        const next = !schemaEnabled;
                        setSchemaEnabled(next);
                        if (next) {
                            setIsMenuOpen(false);
                        }
                    }}
                    onExecute={handleExecuteActiveTab}
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
                            const newTab: EditorTab = {
                                id: newId,
                                title: `Query - ${connection.name}`,
                                query: "",
                                results: [],
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
                                        setTabs((prev) =>
                                            prev.map((tab) =>
                                                tab.id === activeTab.id ? { ...tab, query: value } : tab
                                            )
                                        );
                                    }}
                                />
                            ) : null}
                        </div>

                        <div className={styles.bottom}>
                            {activeTab ? (
                                <ResultsWindow data={activeTab.results} />
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}
