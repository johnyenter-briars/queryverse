import {
    Toast,
    ToastBody,
    ToastTitle,
    Toaster,
    useToastController,
    type ToastIntent,
} from "@fluentui/react-components";

export const APP_TOASTER_ID = "app-toaster";

export const AppToaster = () => (
    <Toaster toasterId={APP_TOASTER_ID} position="top-end" />
);

export const useAppToast = () => {
    const { dispatchToast } = useToastController(APP_TOASTER_ID);

    const notify = (
        title: string,
        message?: string,
        intent: ToastIntent = "info"
    ) => {
        dispatchToast(
            <Toast>
                <ToastTitle>{title}</ToastTitle>
                {message ? <ToastBody>{message}</ToastBody> : null}
            </Toast>,
            { intent }
        );
    };

    const notifyError = (title: string, message?: string) => {
        notify(title, message, "error");
    };

    const notifyWarning = (title: string, message?: string) => {
        notify(title, message, "warning");
    };

    const notifySuccess = (title: string, message?: string) => {
        notify(title, message, "success");
    };

    return { notify, notifyError, notifyWarning, notifySuccess };
};
