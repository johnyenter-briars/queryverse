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
} from "@fluentui/react-icons";
import { queryResults } from "../binding/backend";

export interface IMenuBarProps {
    vimEnabled: boolean;
    onToggleVimEnabled: () => void;
    connectionsEnabled: boolean;
    onToggleConnections: () => void;
}

export function MenuBar({ vimEnabled, connectionsEnabled, onToggleConnections, onToggleVimEnabled }: IMenuBarProps) {
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
                icon={<Play24Filled />}
                title="Execute Query"
                onClick={async () => {await queryResults()}}
            >
                Execute
            </ToolbarButton>
            <ToolbarButton icon={<Settings24Filled />} title="Settings">
                Settings
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