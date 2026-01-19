import { useEffect } from "react";
import { SHORTCUTS, ShortcutActionId } from "../shortcuts";

interface ShortcutManagerProps {
    handlers: Record<ShortcutActionId, () => void>;
    isEnabled: (id: ShortcutActionId) => boolean;
}

export function ShortcutManager({
    handlers,
    isEnabled,
}: ShortcutManagerProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const shortcut = SHORTCUTS.find((entry) => entry.matches(event));
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
