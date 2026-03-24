import {
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
    Stop24Regular,
    DocumentText24Regular,
    Table24Regular,
    FolderOpen24Regular,
    Save24Regular,
    Document24Regular,
    SaveCopy24Regular,
} from "@fluentui/react-icons";

const useMenuBarStyles = makeStyles({
    toolbarSpacer: {
        marginLeft: "auto",
    },
});
export interface IMenuBarProps {
    connectionsEnabled: boolean;
    onToggleConnections: () => void;
    schemaEnabled: boolean;
    onToggleSchema: () => void;
    onExecuteSql: () => void;
    onCancelSql: () => void;
    onPreviewFetchXml: () => void;
    canExecute: boolean;
    isExecuting: boolean;
    canPreview: boolean;
    onOpenSettings: () => void;
    onOpenSqlFile: () => void;
    onSaveSqlFile: () => void;
    canSaveSqlFile: boolean;
    onSaveSqlFileAs: () => void;
}

export function MenuBar({
    connectionsEnabled,
    onToggleConnections,
    schemaEnabled,
    onToggleSchema,
    onExecuteSql,
    onCancelSql,
    onPreviewFetchXml,
    canExecute,
    isExecuting,
    canPreview,
    onOpenSettings,
    onOpenSqlFile,
    onSaveSqlFile,
    canSaveSqlFile,
    onSaveSqlFileAs,
}: IMenuBarProps) {
    const styles = useMenuBarStyles();

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
                icon={isExecuting ? <Stop24Regular /> : <Play24Filled />}
                title={isExecuting ? "Cancel Query" : "Execute Query"}
                disabled={!isExecuting && !canExecute}
                style={isExecuting ? { color: tokens.colorPaletteRedForeground1 } : undefined}
                onClick={async () => {
                    if (isExecuting) {
                        onCancelSql();
                        return;
                    }
                    if (!canExecute) return;
                    onExecuteSql();
                }}
            >
                {isExecuting ? "Cancel" : "Execute"}
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
            <div className={styles.toolbarSpacer} />
        </Toolbar>
    );
}
