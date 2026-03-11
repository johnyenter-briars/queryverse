import { makeStyles, shorthands, tokens, Button, Text } from "@fluentui/react-components";
import { ModalDialog } from "./ModalDialog";

export type DataChangeAction = "update" | "delete" | "insert";

export interface RequestParameterStatus {
    label: string;
    value: string;
    tone: "active" | "inactive" | "partial" | "todo";
}

interface DataChangeConfirmModalProps {
    open: boolean;
    count: number;
    isLoading: boolean;
    action: DataChangeAction;
    requestParameterStatuses: RequestParameterStatus[];
    onConfirm: () => void;
    onCancel: () => void;
}

const actionLabel: Record<DataChangeAction, string> = {
    update: "Update",
    delete: "Delete",
    insert: "Insert",
};

const useStyles = makeStyles({
    body: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
    },
    lead: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
    },
    panel: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusLarge),
        backgroundColor: tokens.colorNeutralBackground2,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    panelTitle: {
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase200,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
    },
    statusList: {
        display: "grid",
        gap: tokens.spacingVerticalXS,
    },
    statusRow: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: tokens.spacingHorizontalM,
        alignItems: "center",
    },
    statusLabel: {
        color: tokens.colorNeutralForeground2,
    },
    statusValue: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "120px",
        ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusCircular),
        fontWeight: tokens.fontWeightSemibold,
    },
    statusActive: {
        backgroundColor: tokens.colorPaletteGreenBackground2,
        color: tokens.colorPaletteGreenForeground1,
    },
    statusInactive: {
        backgroundColor: tokens.colorNeutralBackground3,
        color: tokens.colorNeutralForeground3,
    },
    statusPartial: {
        backgroundColor: tokens.colorPaletteYellowBackground2,
        color: tokens.colorPaletteYellowForeground1,
    },
    statusTodo: {
        backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
        color: tokens.colorPaletteDarkOrangeForeground1,
    },
});

export function DataChangeConfirmModal({
    open,
    count,
    isLoading,
    action,
    requestParameterStatuses,
    onConfirm,
    onCancel,
}: DataChangeConfirmModalProps) {
    const styles = useStyles();
    const label = actionLabel[action];
    const verb = action === "insert" ? "insert" : action;
    const title = `Confirm ${label}`;

    return (
        <ModalDialog
            open={open}
            title={title}
            onClose={onCancel}
            closeLabel="Cancel"
            width="560px"
            actions={
                <>
                    <Button
                        appearance="subtle"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        appearance="primary"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {label}
                    </Button>
                </>
            }
        >
            <div className={styles.body}>
                <Text className={styles.lead}>
                    You&apos;re about to {verb} {count} row{count === 1 ? "" : "s"}. Are you
                    sure?
                </Text>

                <div className={styles.panel}>
                    <Text className={styles.panelTitle}>Current RequestParameters</Text>
                    <div className={styles.statusList}>
                        {requestParameterStatuses.map((status) => (
                            <div key={status.label} className={styles.statusRow}>
                                <Text className={styles.statusLabel}>{status.label}</Text>
                                <span
                                    className={[
                                        styles.statusValue,
                                        status.tone === "active"
                                            ? styles.statusActive
                                            : status.tone === "partial"
                                              ? styles.statusPartial
                                              : status.tone === "todo"
                                                ? styles.statusTodo
                                                : styles.statusInactive,
                                    ].join(" ")}
                                >
                                    {status.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ModalDialog>
    );
}
