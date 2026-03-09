import { isMacHost } from "../utility/platform";

export type ShortcutActionId =
    | "execute"
    | "close-tab"
    | "new-tab"
    | "switch-tab"
    | "save-file";

export type ShortcutDefinition = {
    id: ShortcutActionId;
    label: string;
    keyLabel: string;
    matches: (event: KeyboardEvent) => boolean;
    kind?: "standard" | "custom";
};

type ModifierEvent = Pick<KeyboardEvent, "ctrlKey" | "metaKey">;
type ShortcutDirection = -1 | 0 | 1;

const matchesKey = (event: KeyboardEvent, key: string): boolean =>
    event.key.toLowerCase() === key.toLowerCase();

const formatKeyLabel = (defaultLabel: string, macLabel = defaultLabel): string =>
    isMacHost ? macLabel : defaultLabel;

export const PRIMARY_MODIFIER_LABEL = isMacHost ? "Cmd" : "Ctrl";

export const matchesPrimaryModifier = (event: ModifierEvent): boolean =>
    isMacHost ? event.metaKey : event.ctrlKey;

export const getTabSwitchDirection = (event: KeyboardEvent): ShortcutDirection => {
    if (event.ctrlKey && event.key === "Tab") {
        return event.shiftKey ? -1 : 1;
    }

    if (isMacHost && event.metaKey && event.altKey && !event.ctrlKey) {
        if (event.key === "ArrowRight") return 1;
        if (event.key === "ArrowLeft") return -1;
    }

    return 0;
};

export const isTabSwitchModifierRelease = (event: KeyboardEvent): boolean => {
    if (event.key === "Control") return true;
    if (!isMacHost) return false;
    return event.key === "Meta" || event.key === "Alt";
};

export const SHORTCUTS: ShortcutDefinition[] = [
    {
        id: "execute",
        label: "Execute current query",
        keyLabel: formatKeyLabel("F5 / Ctrl+Enter", "F5 / Cmd+Enter"),
        matches: (event) =>
            event.key === "F5" || (matchesPrimaryModifier(event) && matchesKey(event, "Enter")),
    },
    {
        id: "close-tab",
        label: "Close current tab",
        keyLabel: formatKeyLabel("Ctrl+W", "Cmd+W"),
        matches: (event) =>
            matchesPrimaryModifier(event) && matchesKey(event, "w"),
    },
    {
        id: "new-tab",
        label: "New query tab",
        keyLabel: formatKeyLabel("Ctrl+N", "Cmd+N"),
        matches: (event) =>
            matchesPrimaryModifier(event) && matchesKey(event, "n"),
    },
    {
        id: "save-file",
        label: "Save SQL file",
        keyLabel: formatKeyLabel("Ctrl+S", "Cmd+S"),
        matches: (event) =>
            matchesPrimaryModifier(event) && matchesKey(event, "s"),
    },
    {
        id: "switch-tab",
        label: "Switch tabs (most recent)",
        keyLabel: formatKeyLabel(
            "Ctrl+Tab / Ctrl+Shift+Tab",
            "Ctrl+Tab / Ctrl+Shift+Tab / Cmd+Option+Left/Right"
        ),
        matches: (event) => getTabSwitchDirection(event) !== 0,
        kind: "custom",
    },
];

export const getShortcutLabel = (id: ShortcutActionId): string =>
    SHORTCUTS.find((shortcut) => shortcut.id === id)?.keyLabel ?? "";
