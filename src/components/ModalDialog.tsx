import { ReactNode } from "react";
import {
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Button,
} from "@fluentui/react-components";

interface ModalDialogProps {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    closeLabel?: string;
    width?: string;
}

export function ModalDialog({
    open,
    title,
    onClose,
    children,
    closeLabel = "Close",
    width,
}: ModalDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(_, data) => (data.open ? null : onClose())}>
            <DialogSurface style={width ? { width } : undefined}>
                <DialogBody>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogContent>{children}</DialogContent>
                    <DialogActions>
                        <Button appearance="primary" onClick={onClose}>
                            {closeLabel}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}
