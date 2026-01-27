import { useEffect, useMemo, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Switch,
    Text,
} from "@fluentui/react-components";
import { Settings } from "../binding/model/Settings";
import { useSettingsModalStyles } from "../styles/SettingsModalStyles";

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
        <Dialog open={open} onOpenChange={(_, data) => (data.open ? null : onClose())}>
            <DialogSurface className={styles.surface}>
                <DialogBody>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogContent>
                        <div className={styles.body}>
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
                                    When disabled, app-level shortcuts like Execute (F5) and Save
                                    (Ctrl+S) will not run.
                                </Text>
                            </div>

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
                        </div>
                    </DialogContent>
                    <DialogActions className={styles.actions}>
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
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}

