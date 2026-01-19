import { useEffect } from "react";

interface ShortcutManagerProps {
    onExecute: () => void;
    onCloseActiveTab: () => void;
    canExecute: boolean;
}

export function ShortcutManager({
    onExecute,
    onCloseActiveTab,
    canExecute,
}: ShortcutManagerProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "F5") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (canExecute) {
                    onExecute();
                }
                return;
            }

            if (event.ctrlKey && (event.key === "w" || event.key === "W")) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                onCloseActiveTab();
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [canExecute, onCloseActiveTab, onExecute]);

    return null;
}
