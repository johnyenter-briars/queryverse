import { useEffect, useMemo, useState } from "react";
import {
    Button,
    Input,
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
            draft.keyBindingsEnabled !== settings.keyBindingsEnabled ||
            draft.fontSize !== settings.fontSize ||
            draft.fetchXmlSingleQuotes !== settings.fetchXmlSingleQuotes ||
            draft.bypassCustomPluginExecution !== settings.bypassCustomPluginExecution ||
            draft.suppressCallbackRegistrationExpanderJob !==
                settings.suppressCallbackRegistrationExpanderJob,
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
            width="min(1240px, calc(100vw - 32px))"
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
                <div className={styles.columns}>
                    <div className={styles.mainColumn}>
                        <div className={styles.mainPanel}>
                            <Text weight="semibold">General Settings</Text>

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
                                    When disabled, app-level shortcuts like Execute (F5) and Save
                                    (Ctrl+S) will not run.
                                </Text>
                            </div>

                            <div className={styles.section}>
                                <Text weight="semibold">Font size</Text>
                                <Input
                                    type="number"
                                    min={10}
                                    max={28}
                                    value={String(draft.fontSize)}
                                    onChange={(_, data) => {
                                        const next = Number.parseInt(data.value ?? "", 10);
                                        if (Number.isNaN(next)) return;
                                        const clamped = Math.min(28, Math.max(10, next));
                                        setDraft((prev) => ({
                                            ...prev,
                                            fontSize: clamped,
                                        }));
                                    }}
                                />
                                <Text className={styles.description}>
                                    Controls the editor font size. Ctrl + mouse wheel still zooms
                                    per-tab.
                                </Text>
                            </div>

                            <div className={styles.section}>
                                <Switch
                                    label="Use single quotes in FetchXML preview"
                                    checked={draft.fetchXmlSingleQuotes}
                                    onChange={(_, data) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            fetchXmlSingleQuotes: data.checked,
                                        }))
                                    }
                                />
                                <Text className={styles.description}>
                                    When enabled, the preview uses single-quoted attributes for
                                    easier copying.
                                </Text>
                            </div>

                            <div className={styles.section}>
                                <Text weight="semibold">Keyboard Shortcuts</Text>
                                <div className={styles.shortcutsList}>
                                    {SHORTCUTS.map((shortcut) => (
                                        <div key={shortcut.id} className={styles.shortcutRow}>
                                            <Text className={styles.shortcutKeys}>
                                                {shortcut.keyLabel}
                                            </Text>
                                            <Text>{shortcut.label}</Text>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.sideColumn}>
                        <div className={styles.sidePanel}>
                            <Text weight="semibold">Dataverse RequestParameters</Text>
                            <div className={styles.toggleGroup}>
                                <Switch
                                    label="Bypass custom plugin execution"
                                    checked={draft.bypassCustomPluginExecution}
                                    onChange={(_, data) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            bypassCustomPluginExecution: data.checked,
                                        }))
                                    }
                                />
                                <Text className={styles.description}>
                                    Sends the `MSCRM.BypassCustomPluginExecution` header on create
                                    and update operations when supported.
                                </Text>

                                <Switch
                                    label="Suppress callback registration expander job"
                                    checked={draft.suppressCallbackRegistrationExpanderJob}
                                    onChange={(_, data) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            suppressCallbackRegistrationExpanderJob: data.checked,
                                        }))
                                    }
                                />
                                <Text className={styles.description}>
                                    Sends the `MSCRM.SuppressCallbackRegistrationExpanderJob`
                                    header on create and update operations when supported.
                                </Text>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ModalDialog>
    );
}
