import { useRef, useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    makeStyles,
    shorthands,
    tokens,
    TabList,
    Tab,
    Button,
} from "@fluentui/react-components";
import { Add24Regular } from "@fluentui/react-icons";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";

import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
import { combineClasses } from "./utility/class";
import { MultipleResponse } from "./binding/model/MultipleResponse";
import { Entity } from "./binding/model/Entity";

const DRAWER_WIDTH = "300px";

const useStyles = makeStyles({
    // Global App Layout
    root: {
        ...shorthands.padding(0),
        ...shorthands.margin(0),
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: webDarkTheme.colorNeutralBackground1,
        color: webDarkTheme.colorNeutralForeground1,
        overflow: "hidden",
    },
    // Main Wrapper for the Flyout and Content Area
    wrapper: {
        flex: 1,
        display: "flex",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
    },
    
    // BASE Content Area Style (ALWAYS applied)
    contentArea: {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flexGrow: 1,
        transitionDuration: tokens.durationNormal,
        transitionProperty: "margin-left, width",
        width: "100%", 
        marginLeft: "0", 
    },
    // SHIFTED Class (Applied conditionally for dynamic effect)
    contentShifted: {
        marginLeft: DRAWER_WIDTH,
        width: `calc(100% - ${DRAWER_WIDTH})`,
    },

    // Placeholder Sections
    top: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        overflow: "hidden",
    },
    tabsBar: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        paddingBottom: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalXS,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    tabLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    tabClose: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        borderRadius: tokens.borderRadiusCircular,
        color: tokens.colorNeutralForeground2,
        cursor: "pointer",
        userSelect: "none",
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
            color: tokens.colorNeutralForeground1,
        },
        "&:active": {
            backgroundColor: tokens.colorNeutralBackground1Pressed,
        },
    },
    tabsList: {
        flex: 1,
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
    },
    addTabButton: {
        flexShrink: 0,
    },
    bottom: {
        flex: 1,
        overflowY: "auto",
        padding: tokens.spacingHorizontalM,
    },
    
    // BASE Flyout Style (ALWAYS applied - handles hidden state/transition)
    flyoutBase: {
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        // Initial state: hidden off-screen to the left
        transform: `translateX(-${DRAWER_WIDTH})`,
		//@ts-expect-error TODO: Fix this
        transition: `transform ${tokens.durationNormal} ${tokens.curveEasyInOut}`,
        ...shorthands.borderRight(`1px solid ${tokens.colorNeutralStroke1}`),
    },
    // OPEN Class (Applied conditionally to override transform to visible state)
    flyoutOpen: {
        transform: "translateX(0)", 
    },

    flyoutHalf: {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        ...shorthands.padding(tokens.spacingHorizontalM),
    },
    // Custom scrollbar CSS (Remains the same)
    customScroll: {
        "&::-webkit-scrollbar": { width: "10px", height: "10px" },
        "&::-webkit-scrollbar-track": { background: "#282828", ...shorthands.borderRadius("5px") },
        "&::-webkit-scrollbar-thumb": { background: "#555555", ...shorthands.borderRadius("5px") },
        "&::-webkit-scrollbar-thumb:hover": { background: "#777777" },
        "&::-webkit-scrollbar-corner": { background: "#1f1f1f" },
    },
});

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

    const styles = useStyles();

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

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <MenuBar
                    vimEnabled={vimEnabled}
					connectionsEnabled={connectionsEnabled}
                    onToggleVimEnabled={() => setVimEnabled(!vimEnabled)} 
                    onToggleConnections={() => setIsMenuOpen(!connectionsEnabled)} 
                    onRetrieveResults={onRetrieveResults}
                    canExecute={Boolean(activeTab)}
                />

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
