import {
    webDarkTheme,
    makeStyles,
    shorthands,
    tokens,
    Title3,
    Tree,
    TreeItem,
    TreeItemLayout,
    Divider,
} from "@fluentui/react-components";
import {
    Table24Filled,
    FolderOpen24Filled,
} from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";

const DRAWER_WIDTH = "300px";

const useStyles = makeStyles({
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

export interface IConnectionsMenuProps {
    isOpen: boolean
};

export function ConnectionsMenu({ isOpen }: IConnectionsMenuProps) {
    const styles = useStyles();

    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const mockSchema = [
        { name: "d365 dev", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 qa", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 prod", tables: ["systemuser", "account", "contact", "incident"] },
    ];
    const mockConnections = [
        { name: "d365 dev", status: "Active" },
        { name: "d365 qa", status: "Inactive" },
        { name: "d365 prod", status: "Active" },
    ];

    return (
        <div 
            className={flyoutClasses} 
            style={{ pointerEvents: isOpen ? 'auto' : 'none' }} 
        >
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

            <Divider />

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