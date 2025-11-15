import * as React from "react";
import { useState, useMemo } from "react";
import {
    FluentProvider,
    webDarkTheme,
    makeStyles,
    shorthands,
    tokens,
    Title3,
    Tree,
    TreeItem,
    TreeItemLayout,
    Toolbar,
    ToolbarButton,
    Divider,
} from "@fluentui/react-components";
import {
    Navigation24Regular, // Icon for opening the flyout
    CubeTree24Filled, // Icon for Schema
    Table24Filled, // Icon for Tables
    FolderOpen24Filled, // Icon for Database/Connection
    Settings24Filled,
    Play24Filled,
} from "@fluentui/react-icons";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";

// --- Styles ---

const DRAWER_WIDTH = "300px";

// All styles are static definitions. useStyles() will return an object 
// where keys map to static class names.
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
        padding: tokens.spacingHorizontalS,
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
		//@ts-expect-error TODO: Fix thsi
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

// --- MenuBar Component (Simplified) ---

type MenuBarProps = {
    vimEnabled: boolean;
    onToggleVim: () => void;
    onToggleConnections: () => void;
};

function MenuBar({ onToggleConnections }: MenuBarProps) {
    return (
        <Toolbar 
			size="medium" 
			//@ts-ignore TODO: fix this
			style={{ ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalS) }}
		>
            <ToolbarButton
                icon={<Navigation24Regular />}
                onClick={onToggleConnections}
                title="Toggle Connections Menu"
            >
                Connections
            </ToolbarButton>
            <ToolbarButton icon={<Play24Filled />} title="Execute Query">
                Execute
            </ToolbarButton>
            <ToolbarButton icon={<Settings24Filled />} title="Settings">
                Settings
            </ToolbarButton>
        </Toolbar>
    );
}

// --- ConnectionsMenu Component (The new Flyout) ---

type ConnectionsMenuProps = {
    isOpen: boolean;
};

/**
 * A left-side flyout containing two sections: Connections and Schema.
 */
function ConnectionsMenu({ isOpen }: ConnectionsMenuProps) {
    // Call useStyles without arguments for static class names
    const styles = useStyles();

    // Utility to combine classes safely
    const combineClasses = (...classes: (string | false | undefined)[]) => {
        return classes.filter(Boolean).join(' ');
    };

    // Apply base class + open class conditionally
    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    // Mock data
    const mockSchema = [
        { name: "production_db", tables: ["users", "orders", "products", "transactions"] },
        { name: "analytics_wh", tables: ["events", "sessions", "clicks"] },
        { name: "staging_db", tables: ["temp_data"] },
    ];
    const mockConnections = [
        { name: "Primary Localhost (SQL)", status: "Active" },
        { name: "Dev Server (SSH Tunnel)", status: "Inactive" },
        { name: "QA Read Replica", status: "Active" },
    ];

    return (
        <div 
            className={flyoutClasses} 
            style={{ pointerEvents: isOpen ? 'auto' : 'none' }} 
        >
            {/* Top Half: Connections Tree */}
            <div className={`${styles.flyoutHalf} ${styles.customScroll}`}>
                <Title3 className="mb-2">Connections</Title3>
                <Divider />
                <Tree size="small" aria-label="Connections List">
                    {mockConnections.map((conn, index) => (
                        <TreeItem key={`conn-${index}`} itemType="leaf">
                            <TreeItemLayout>
                                <FolderOpen24Filled 
                                    style={{ color: conn.status === 'Active' ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForegroundDisabled }}
                                /> 
                                {conn.name}
                            </TreeItemLayout>
                        </TreeItem>
                    ))}
                </Tree>
            </div>

            {/* Middle Divider */}
            <Divider />

            {/* Bottom Half: Schema Tree */}
            <div className={`${styles.flyoutHalf} ${styles.customScroll}`}>
                <Title3 className="mb-2">Schema Explorer</Title3>
                <Divider />
                <Tree size="small" aria-label="Database Schema">
                    {mockSchema.map((db, dbIndex) => (
                        <TreeItem key={`db-${dbIndex}`} itemType="branch">
                            <TreeItemLayout><FolderOpen24Filled /> {db.name}</TreeItemLayout>
                            <Tree>
                                {db.tables.map((table, tableIndex) => (
                                    <TreeItem key={`table-${dbIndex}-${tableIndex}`} itemType="leaf">
                                        <TreeItemLayout><Table24Filled /> {table}</TreeItemLayout>
                                    </TreeItem>
                                ))}
                            </Tree>
                        </TreeItem>
                    ))}
                </Tree>
            </div>
        </div>
    );
}

// --- Main App Component ---

export default function App() {
    // State to control the visibility and shift of the menu/content
    const [isMenuOpen, setIsMenuOpen] = useState(true); 
    const [vimEnabled, setVimEnabled] = useState(true); 

    // Styles are now static, call without arguments
    const styles = useStyles();

    // Utility to combine classes safely
    const combineClasses = (...classes: (string | false | undefined)[]) => {
        return classes.filter(Boolean).join(' ');
    };

    // Apply base class + shifted class conditionally
    const contentClasses = combineClasses(
        styles.contentArea,
        isMenuOpen && styles.contentShifted
    );

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                {/* 1. Menu Bar */}
                <MenuBar
                    vimEnabled={vimEnabled}
                    onToggleVim={() => setVimEnabled(!vimEnabled)}
                    onToggleConnections={() => setIsMenuOpen(!isMenuOpen)} // Toggle logic
                />

                <div className={styles.wrapper}>
                    {/* 2. Connections Flyout Menu */}
                    <ConnectionsMenu isOpen={isMenuOpen} />

                    {/* 3. Main Content Area */}
                    <div className={contentClasses}> 
                        
                        {/* Placeholder for CustomEditor */}
                        <div className={styles.top}>
							<CustomEditor
								vimEnabled={vimEnabled}
							/>
                        </div>

                        {/* Placeholder for ResultsWindow */}
                        <div className={styles.bottom}>
							<ResultsWindow />
                        </div>
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}
