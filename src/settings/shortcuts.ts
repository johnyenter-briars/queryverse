export type ShortcutActionId = "execute" | "close-tab" | "new-tab";

export type ShortcutDefinition = {
    id: ShortcutActionId;
    label: string;
    keyLabel: string;
    matches: (event: KeyboardEvent) => boolean;
};

export const SHORTCUTS: ShortcutDefinition[] = [
    {
        id: "execute",
        label: "Execute current query",
        keyLabel: "F5",
        matches: (event) => event.key === "F5",
    },
    {
        id: "close-tab",
        label: "Close current tab",
        keyLabel: "Ctrl+W",
        matches: (event) =>
            event.ctrlKey && (event.key === "w" || event.key === "W"),
    },
    {
        id: "new-tab",
        label: "New query tab",
        keyLabel: "Ctrl+N",
        matches: (event) =>
            event.ctrlKey && (event.key === "n" || event.key === "N"),
    },
];
