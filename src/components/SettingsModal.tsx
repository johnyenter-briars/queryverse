import { useEffect, useMemo, useState } from "react";
import {
    Button,
    Input,
    Switch,
    Text,
} from "@fluentui/react-components";
import { Settings } from "../binding/model/Settings";
import { useSettingsModalStyles } from "../styles/SettingsModalStyles";
import {
    getShortcutLabel,
    PRIMARY_MODIFIER_LABEL,
    SHORTCUTS,
} from "../settings/shortcuts";
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
    const executeShortcutLabel = getShortcutLabel("execute") || "F5";
    const saveShortcutLabel = getShortcutLabel("save-file") || `${PRIMARY_MODIFIER_LABEL}+S`;

    useEffect(() => {
        if (!open) return;
        setDraft(settings);
    }, [open, settings]);

    const isDirty = useMemo(
        () =>
            draft.vimEnabled !== settings.vimEnabled ||
            draft.keyBindingsEnabled !== settings.keyBindingsEnabled ||
            draft.fontSize !== settings.fontSize ||
            draft.fetchXmlSingleQuotes !== settings.fetchXmlSingleQuotes,
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
                        {`When disabled, app-level shortcuts like Execute (${executeShortcutLabel}) and Save (${saveShortcutLabel}) will not run.`}
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
                        {`Controls the editor font size. ${PRIMARY_MODIFIER_LABEL} + mouse wheel still zooms per-tab.`}
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
                        When enabled, the preview uses single-quoted attributes for easier copying.
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
