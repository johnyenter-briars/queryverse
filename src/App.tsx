import { useRef, useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    makeStyles,
    TabList,
    Tab,
    Button,
} from "@fluentui/react-components";
import { Add24Regular } from "@fluentui/react-icons";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";
import { ShortcutManager } from "./components/ShortcutManager";
import { ModalDialog } from "./components/ModalDialog";

import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
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
};

export default function App() {
    const [connectionsEnabled, setIsMenuOpen] = useState(true); 
    const [vimEnabled, setVimEnabled] = useState(true); 
    const [tabs, setTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = useState(0);
    const nextTabId = useRef(1);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const styles = useAppStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        connectionsEnabled && styles.contentShifted
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
        const response = await retrieveMultiple();
        onRetrieveResults(response);
    };

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <MenuBar
                    vimEnabled={vimEnabled}
					connectionsEnabled={connectionsEnabled}
                    onToggleVimEnabled={() => setVimEnabled(!vimEnabled)} 
                    onToggleConnections={() => setIsMenuOpen(!connectionsEnabled)} 
                    onExecute={handleExecuteActiveTab}
                    canExecute={Boolean(activeTab)}
                    onShowShortcuts={() => setShortcutsOpen(true)}
                />
                <ShortcutManager
                    handlers={{
                        execute: handleExecuteActiveTab,
                        "close-tab": handleCloseActiveTab,
                    }}
                    isEnabled={(id: ShortcutActionId) =>
                        id === "execute" ? Boolean(activeTab) : Boolean(activeTabId)
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

                <div className={styles.wrapper}>
                    <ConnectionsMenu isOpen={connectionsEnabled} />

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
