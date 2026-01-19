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
                if (canExecute) {
                    onExecute();
                }
                return;
            }

            if (event.ctrlKey && (event.key === "w" || event.key === "W")) {
                event.preventDefault();
                onCloseActiveTab();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [canExecute, onCloseActiveTab, onExecute]);

    return null;
}
