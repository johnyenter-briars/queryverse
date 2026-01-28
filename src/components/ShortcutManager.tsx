import { useEffect } from "react";
import { SHORTCUTS, ShortcutActionId } from "../settings/shortcuts";

interface ShortcutManagerProps {
    handlers: Partial<Record<ShortcutActionId, () => void>>;
    isEnabled: (id: ShortcutActionId) => boolean;
}

export function ShortcutManager({
    handlers,
    isEnabled,
}: ShortcutManagerProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Tab") {
                console.log("foo4");
                const target = event.target as HTMLElement | null;
                if (target && target.closest(".monaco-editor")) {
                    console.log("foo5");
                    event.preventDefault();
                    return;
                }
            }

            const shortcut = SHORTCUTS.find(
                (entry) => (entry.kind ?? "standard") === "standard" && entry.matches(event)
            );
            if (!shortcut) return;
            if (!isEnabled(shortcut.id)) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            handlers[shortcut.id]?.();
        };

        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [handlers, isEnabled]);

    return null;
}
