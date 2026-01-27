import { useEffect, useMemo, useState } from "react";
import {
    Button,
    Switch,
    Text,
} from "@fluentui/react-components";
import { Settings } from "../binding/model/Settings";
import { useSettingsModalStyles } from "../styles/SettingsModalStyles";
import { SHORTCUTS } from "../settings/shortcuts";
import { ModalDialog } from "./ModalDialog";

export interface SettingsModalProps {
    open: boolean;
    settings: Settings;
    onClose: () => void;
    onSave: (nextSettings: Settings) => Promise<void> | void;
    isSaving?: boolean;
}

export function SettingsModal({
    open,
    settings,
    onClose,
    onSave,
    isSaving,
}: SettingsModalProps) {
    const styles = useSettingsModalStyles();
    const [draft, setDraft] = useState<Settings>(settings);

    useEffect(() => {
        if (!open) return;
        setDraft(settings);
    }, [open, settings]);

    const isDirty = useMemo(
        () =>
            draft.vimEnabled !== settings.vimEnabled ||
            draft.keyBindingsEnabled !== settings.keyBindingsEnabled,
        [draft, settings]
    );

    const handleSave = async () => {
        await onSave(draft);
    };

    return (
        <ModalDialog
            open={open}
            title="Settings"
            onClose={onClose}
            width="420px"
            actions={
                <>
                    <Button appearance="secondary" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button
                        appearance="primary"
                        onClick={handleSave}
                        disabled={isSaving || !isDirty}
                    >
                        Save
                    </Button>
                </>
            }
        >
            <div className={styles.body}>
                <div className={styles.section}>
                    <Switch
                        label="Enable Vim mode"
                        checked={draft.vimEnabled}
                        onChange={(_, data) =>
                            setDraft((prev) => ({
                                ...prev,
                                vimEnabled: data.checked,
                            }))
                        }
                    />
                    <Text className={styles.description}>
                        Vim mode applies to SQL query tabs (not read-only tabs).
                    </Text>
                </div>

                <div className={styles.section}>
                    <Switch
                        label="Enable keyboard shortcuts"
                        checked={draft.keyBindingsEnabled}
                        onChange={(_, data) =>
                            setDraft((prev) => ({
                                ...prev,
                                keyBindingsEnabled: data.checked,
                            }))
                        }
                    />
                    <Text className={styles.description}>
                        When disabled, app-level shortcuts like Execute (F5) and Save (Ctrl+S)
                        will not run.
                    </Text>
                </div>

                <div className={styles.section}>
                    <Text weight="semibold">Keyboard Shortcuts</Text>
                    <div className={styles.shortcutsList}>
                        {SHORTCUTS.map((shortcut) => (
                            <div key={shortcut.id} className={styles.shortcutRow}>
                                <Text className={styles.shortcutKeys}>{shortcut.keyLabel}</Text>
                                <Text>{shortcut.label}</Text>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ModalDialog>
    );
}
