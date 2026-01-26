import {
    Text,
    makeStyles,
    shorthands,
    tokens,
    Toolbar,
    ToolbarButton,
} from "@fluentui/react-components";

import {
    PlugConnected24Regular,
    Settings24Filled,
    Play24Filled,
    WindowConsole20Filled,
    DocumentText24Regular,
    Keyboard24Regular,
    Table24Regular,
    Link24Filled,
    FolderOpen24Regular,
    Save24Regular,
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
    vimEnabled: boolean;
    onToggleVimEnabled: () => void;
    connectionsEnabled: boolean;
    onToggleConnections: () => void;
    schemaEnabled: boolean;
    onToggleSchema: () => void;
    onExecuteSql: () => void;
    onPreviewFetchXml: () => void;
    canExecute: boolean;
    onShowShortcuts: () => void;
    onOpenSqlFile: () => void;
    onSaveSqlFileAs: () => void;
    currentConnection: Connection | null;
}

export function MenuBar({
    vimEnabled,
    connectionsEnabled,
    onToggleConnections,
    schemaEnabled,
    onToggleSchema,
    onToggleVimEnabled,
    onExecuteSql,
    onPreviewFetchXml,
    canExecute,
    onShowShortcuts,
    onOpenSqlFile,
    onSaveSqlFileAs,
    currentConnection,
}: IMenuBarProps) {
    const styles = useMenuBarStyles();
    const connectionLabel = currentConnection?.name ?? "No connection";
    const connectionTitle = currentConnection?.d365Url
        ? `Connected to ${currentConnection.d365Url}`
        : "No connection selected";

    return (
        <Toolbar
            size="medium"
            //@ts-ignore TODO: fix this
            style={{ ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalS) }}
        >
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
                icon={<FolderOpen24Regular />}
                title="Open SQL File"
                onClick={onOpenSqlFile}
            >
                Open SQL File
            </ToolbarButton>
            <ToolbarButton
                icon={<Save24Regular />}
                title="Save SQL File As"
                onClick={onSaveSqlFileAs}
            >
                Save As
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
                onClick={onPreviewFetchXml}
            >
                Preview FetchXML
            </ToolbarButton>
            <ToolbarButton icon={<Settings24Filled />} title="Settings">
                Settings
            </ToolbarButton>
            <ToolbarButton
                icon={<Keyboard24Regular />}
                title="Keyboard Shortcuts"
                onClick={onShowShortcuts}
            >
                Shortcuts
            </ToolbarButton>
            <ToolbarButton
                icon={<WindowConsole20Filled />}
                appearance={vimEnabled ? "primary" : "subtle"}
                title="Vim Mode"
                onClick={onToggleVimEnabled}
            >
                Vim Mode
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
