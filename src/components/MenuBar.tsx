import {
    Text,
    makeStyles,
    shorthands,
    tokens,
    Toolbar,
    ToolbarButton,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
} from "@fluentui/react-components";

import {
    PlugConnected24Regular,
    Settings24Filled,
    Play24Filled,
    DocumentText24Regular,
    Table24Regular,
    Link24Filled,
    FolderOpen24Regular,
    Save24Regular,
    Document24Regular,
    SaveCopy24Regular,
} from "@fluentui/react-icons";
import { Connection } from "../binding/model/Connection";

const useMenuBarStyles = makeStyles({
    connectionInfo: {
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        color: tokens.colorNeutralForeground2,
        ...shorthands.padding(0, tokens.spacingHorizontalS),
    },
    connectionName: {
        color: tokens.colorNeutralForeground1,
    },
    connectionIcon: {
        color: tokens.colorPaletteGreenForeground1,
    },
});
export interface IMenuBarProps {
    connectionsEnabled: boolean;
    onToggleConnections: () => void;
    schemaEnabled: boolean;
    onToggleSchema: () => void;
    onExecuteSql: () => void;
    onPreviewFetchXml: () => void;
    canExecute: boolean;
    canPreview: boolean;
    onOpenSettings: () => void;
    onOpenSqlFile: () => void;
    onSaveSqlFile: () => void;
    canSaveSqlFile: boolean;
    onSaveSqlFileAs: () => void;
    currentConnection: Connection | null;
}

export function MenuBar({
    connectionsEnabled,
    onToggleConnections,
    schemaEnabled,
    onToggleSchema,
    onExecuteSql,
    onPreviewFetchXml,
    canExecute,
    canPreview,
    onOpenSettings,
    onOpenSqlFile,
    onSaveSqlFile,
    canSaveSqlFile,
    onSaveSqlFileAs,
    currentConnection,
}: IMenuBarProps) {
    const styles = useMenuBarStyles();
    const connectionLabel = currentConnection?.name ?? "No connection";
    const connectionTitle = currentConnection?.dataverseUrl
        ? `Connected to ${currentConnection.dataverseUrl}`
        : "No connection selected";

    return (
        <Toolbar
            size="medium"
            //@ts-ignore TODO: fix this
            style={{ ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalS) }}
        >
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <ToolbarButton icon={<Document24Regular />} title="File">
                        File
                    </ToolbarButton>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem icon={<FolderOpen24Regular />} onClick={onOpenSqlFile}>
                            Open SQL File
                        </MenuItem>
                        <MenuItem
                            icon={<Save24Regular />}
                            onClick={onSaveSqlFile}
                            disabled={!canSaveSqlFile}
                        >
                            Save
                        </MenuItem>
                        <MenuItem icon={<SaveCopy24Regular />} onClick={onSaveSqlFileAs}>
                            Save As
                        </MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>
            <ToolbarButton
                icon={<PlugConnected24Regular />}
                onClick={onToggleConnections}
                appearance={connectionsEnabled ? "primary" : "subtle"}
                title="Toggle Connections Menu"
            >
                Connections
            </ToolbarButton>
            <ToolbarButton
                icon={<Table24Regular />}
                onClick={onToggleSchema}
                appearance={schemaEnabled ? "primary" : "subtle"}
                title="Toggle Schema Explorer"
            >
                Schema
            </ToolbarButton>
            <ToolbarButton
                icon={<Play24Filled />}
                title="Execute Query"
                disabled={!canExecute}
                onClick={async () => {
                    if (!canExecute) return;
                    onExecuteSql();
                }}
            >
                Execute
            </ToolbarButton>
            <ToolbarButton
                icon={<DocumentText24Regular />}
                title="Preview FetchXML"
                disabled={!canPreview}
                onClick={onPreviewFetchXml}
            >
                Preview FetchXML
            </ToolbarButton>
            <ToolbarButton icon={<Settings24Filled />} title="Settings" onClick={onOpenSettings}>
                Settings
            </ToolbarButton>
            <div className={styles.connectionInfo} title={connectionTitle}>
                <Link24Filled className={styles.connectionIcon} />
                <Text size={200}>Connection:</Text>
                <Text size={200} className={styles.connectionName}>
                    {connectionLabel}
                </Text>
            </div>
        </Toolbar>
    );
}
