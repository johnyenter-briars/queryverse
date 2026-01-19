import { useEffect, useRef, useState } from "react";
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

type TabSwitchState = {
    isCycling: boolean;
    pressCount: number;
    index: number;
    show: boolean;
    list: number[];
};

export default function App() {
    const [connectionsEnabled, setIsMenuOpen] = useState(true); 
    const [vimEnabled, setVimEnabled] = useState(true); 
    const [tabs, setTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = useState(0);
    const [tabMru, setTabMru] = useState<number[]>([]);
    const [tabSwitch, setTabSwitch] = useState<TabSwitchState>({
        isCycling: false,
        pressCount: 0,
        index: 0,
        show: false,
        list: [],
    });
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
    const tabMap = new Map(tabs.map((tab) => [tab.id, tab]));
    const tabSwitchList =
        tabSwitch.isCycling && tabSwitch.list.length > 0 ? tabSwitch.list : tabMru;

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

    useEffect(() => {
        const existingIds = new Set(tabs.map((tab) => tab.id));
        setTabMru((prev) => {
            const filtered = prev.filter((id) => existingIds.has(id));
            const missing = tabs.map((tab) => tab.id).filter((id) => !filtered.includes(id));
            return [...filtered, ...missing];
        });
    }, [tabs]);

    useEffect(() => {
        if (activeTabId === 0 || tabSwitch.isCycling) return;
        setTabMru((prev) => {
            const without = prev.filter((id) => id !== activeTabId);
            return [activeTabId, ...without];
        });
    }, [activeTabId, tabSwitch.isCycling]);

    useEffect(() => {
        if (tabs.length < 2 && tabSwitch.isCycling) {
            setTabSwitch({
                isCycling: false,
                pressCount: 0,
                index: 0,
                show: false,
                list: [],
            });
        }
    }, [tabs.length, tabSwitch.isCycling]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey || event.key !== "Tab") return;
            if (tabMru.length < 2) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            setTabSwitch((prev) => {
                const list = prev.isCycling ? prev.list : tabMru;
                const nextIndex = prev.isCycling ? (prev.index + 1) % list.length : 1;
                const nextPressCount = prev.isCycling ? prev.pressCount + 1 : 1;
                const nextShow = nextPressCount > 1;
                const nextId = list[nextIndex];
                if (nextId) {
                    setActiveTabId(nextId);
                }
                return {
                    isCycling: true,
                    pressCount: nextPressCount,
                    index: nextIndex,
                    show: nextShow,
                    list,
                };
            });
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key !== "Control") return;
            setTabSwitch({
                isCycling: false,
                pressCount: 0,
                index: 0,
                show: false,
                list: [],
            });
        };

        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
        };
    }, [tabMru]);

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
                        "new-tab": handleAddTab,
                    }}
                    isEnabled={(id: ShortcutActionId) =>
                        id === "execute" ? Boolean(activeTab) : true
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
                {tabSwitch.show && tabSwitchList.length > 1 ? (
                    <div className={styles.tabSwitcher} role="listbox" aria-label="Tabs">
                        {tabSwitchList.map((id, index) => {
                            const tab = tabMap.get(id);
                            if (!tab) return null;
                            const itemClasses = combineClasses(
                                styles.tabSwitcherItem,
                                index === tabSwitch.index && styles.tabSwitcherItemActive
                            );
                            return (
                                <div
                                    key={id}
                                    className={itemClasses}
                                    aria-selected={index === tabSwitch.index}
                                >
                                    <span className={styles.tabSwitcherTitle}>{tab.title}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : null}

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
