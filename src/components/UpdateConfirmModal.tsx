import { Button } from "@fluentui/react-components";
import { ModalDialog } from "./ModalDialog";

export type DataChangeAction = "update" | "delete" | "insert";

interface DataChangeConfirmModalProps {
    open: boolean;
    count: number;
    isLoading: boolean;
    action: DataChangeAction;
    onConfirm: () => void;
    onCancel: () => void;
}

const actionLabel: Record<DataChangeAction, string> = {
    update: "Update",
    delete: "Delete",
    insert: "Insert",
};

export function DataChangeConfirmModal({
    open,
    count,
    isLoading,
    action,
    onConfirm,
    onCancel,
}: DataChangeConfirmModalProps) {
    const label = actionLabel[action];
    const verb = action === "insert" ? "insert" : action;
    const title = `Confirm ${label}`;

    // TODO: Add contextual details (table name, columns) per action.
    // TODO: Provide an optional "show affected rows" preview.

    return (
        <ModalDialog
            open={open}
            title={title}
            onClose={onCancel}
            closeLabel="Cancel"
            width="360px"
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
            <div>
                You&apos;re about to {verb} {count} record
                {count === 1 ? "" : "s"}. Are you sure?
            </div>
        </ModalDialog>
    );
}
