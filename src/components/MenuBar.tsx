import {
    shorthands,
    tokens,
    Toolbar,
    ToolbarButton,
} from "@fluentui/react-components";

import {
    Navigation24Regular,
    Settings24Filled,
    Play24Filled,
    WindowConsole20Filled,
    Keyboard24Regular,
    Table24Regular,
} from "@fluentui/react-icons";
export interface IMenuBarProps {
    vimEnabled: boolean;
    onToggleVimEnabled: () => void;
    connectionsEnabled: boolean;
    onToggleConnections: () => void;
    schemaEnabled: boolean;
    onToggleSchema: () => void;
    onExecute: () => void;
    canExecute: boolean;
    onShowShortcuts: () => void;
}

export function MenuBar({
    vimEnabled,
    connectionsEnabled,
    onToggleConnections,
    schemaEnabled,
    onToggleSchema,
    onToggleVimEnabled,
    onExecute,
    canExecute,
    onShowShortcuts,
}: IMenuBarProps) {
    return (
        <Toolbar
            size="medium"
            //@ts-ignore TODO: fix this
            style={{ ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalS) }}
        >
            <ToolbarButton
                icon={<Navigation24Regular />}
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
                    onExecute();
                }}
            >
                Execute
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
        </Toolbar>
    );
}
