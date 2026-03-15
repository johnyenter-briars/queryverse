import {
    tokens,
    Title3,
    Tree,
    TreeItem,
    TreeItemLayout,
    Divider,
    Button,
    Field,
    Input,
    RadioGroup,
    Radio,
    Text,
} from "@fluentui/react-components";
import {
    Link24Filled,
    AddCircleRegular,
    Open24Regular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { combineClasses } from "../utility/class";
import { createConnection, listConnections, updateConnection } from "../binding/function";
import { Connection } from "../binding/model/Connection";
import { RequestType } from "../binding/model/QVRequest";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { ModalDialog } from "./ModalDialog";
import { logError } from "../utility/logging";

type ConnectionMethod = "ClientCredentials" | "DeviceCode";

type ConnectionFormState = {
    method: ConnectionMethod;
    name: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath: string;
};

const emptyFormState = (method: ConnectionMethod = "ClientCredentials"): ConnectionFormState => ({
    method,
    name: "",
    clientId: "",
    clientSecret: "",
    tenantId: "",
    dataverseUrl: "",
    tokenCacheStorePath: "",
});

const isClientCredentials = (
    connection: Connection
): connection is Connection & { auth: { method: "ClientCredentials"; clientSecret: string } } =>
    connection.auth.method === "ClientCredentials";

const toFormState = (connection: Connection): ConnectionFormState => ({
    method: connection.auth.method,
    name: connection.name ?? "",
    clientId: connection.auth.clientId ?? "",
    clientSecret: isClientCredentials(connection) ? connection.auth.clientSecret ?? "" : "",
    tenantId: connection.auth.tenantId ?? "",
    dataverseUrl: connection.auth.dataverseUrl ?? "",
    tokenCacheStorePath: connection.auth.tokenCacheStorePath ?? "",
});

const validationErrorFor = (state: ConnectionFormState): string | null => {
    if (!state.name.trim()) {
        return "Connection name is required.";
    }

    if (!state.clientId.trim()) {
        return "Client ID is required.";
    }

    if (!state.dataverseUrl.trim()) {
        return "Dataverse URL is required.";
    }

    if (state.method === "ClientCredentials") {
        if (!state.clientSecret.trim()) {
            return "Client secret is required.";
        }
        if (!state.tenantId.trim()) {
            return "Tenant ID is required.";
        }
    }

    return null;
};

const buildPayload = (state: ConnectionFormState) =>
    state.method === "ClientCredentials"
        ? {
              method: "ClientCredentials" as const,
              name: state.name.trim(),
              clientId: state.clientId.trim(),
              clientSecret: state.clientSecret,
              tenantId: state.tenantId.trim(),
              dataverseUrl: state.dataverseUrl.trim(),
              tokenCacheStorePath: state.tokenCacheStorePath.trim() || null,
          }
        : {
              method: "DeviceCode" as const,
              name: state.name.trim(),
              clientId: state.clientId.trim(),
              tenantId: state.tenantId.trim(),
              dataverseUrl: state.dataverseUrl.trim(),
              tokenCacheStorePath: state.tokenCacheStorePath.trim() || null,
          };

export interface IConnectionsMenuProps {
    isOpen: boolean;
    onOpenConnection: (connection: Connection) => void;
}

export function ConnectionsMenu({ isOpen, onOpenConnection }: IConnectionsMenuProps) {
    const styles = useConnectionsMenuStyles();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [createStatus, setCreateStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [editStatus, setEditStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [createFormState, setCreateFormState] = useState<ConnectionFormState>(
        emptyFormState()
    );
    const [editFormState, setEditFormState] = useState<ConnectionFormState>(emptyFormState());

    const flyoutClasses = combineClasses(styles.flyoutBase, isOpen && styles.flyoutOpen);

    const loadConnections = async () => {
        try {
            const response = await listConnections();
            if (response.success) {
                setConnections(response.value);
            }
        } catch (error) {
            logError("Failed to load connections", error, "queryverse::frontend::connections");
        }
    };

    useEffect(() => {
        loadConnections();
    }, []);

    const closeCreate = () => {
        setCreateOpen(false);
        setCreateFormState(emptyFormState());
        setCreateStatus(null);
    };

    const closeEdit = () => {
        setEditOpen(false);
        setEditIndex(null);
        setEditStatus(null);
    };

    const openEdit = (connection: Connection, index: number) => {
        setEditIndex(index);
        setEditFormState(toFormState(connection));
        setEditStatus(null);
        setEditOpen(true);
    };

    const handleCreateConnection = async () => {
        setCreateStatus(null);
        const validationError = validationErrorFor(createFormState);
        if (validationError) {
            setCreateStatus({ type: "error", message: validationError });
            return;
        }

        try {
            const response = await createConnection({
                requestType: RequestType.Create,
                value: buildPayload(createFormState),
            });

            if (response.success) {
                setConnections((prev) => [...prev, response.value]);
                setCreateStatus({
                    type: "success",
                    message: response.message || "Connection validated.",
                });
            } else {
                setCreateStatus({
                    type: "error",
                    message: response.message || "Failed to create connection.",
                });
            }
        } catch (error) {
            setCreateStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to create connection.",
            });
        }
    };

    const handleSaveEdit = async () => {
        setEditStatus(null);
        const validationError = validationErrorFor(editFormState);
        if (validationError) {
            setEditStatus({ type: "error", message: validationError });
            return;
        }

        if (editIndex === null) {
            setEditStatus({ type: "error", message: "No connection selected." });
            return;
        }

        try {
            const response = await updateConnection({
                id: connections[editIndex]?.id ?? null,
                index: editIndex,
                payload: buildPayload(editFormState),
            });

            if (response.success) {
                await loadConnections();
                setEditStatus({
                    type: "success",
                    message: response.message || "Connection updated.",
                });
            } else {
                setEditStatus({
                    type: "error",
                    message: response.message || "Failed to update connection.",
                });
            }
        } catch (error) {
            setEditStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to update connection.",
            });
        }
    };

    const renderForm = (
        formState: ConnectionFormState,
        setFormState: Dispatch<SetStateAction<ConnectionFormState>>
    ) => (
        <div style={{ display: "grid", gap: "12px" }}>
            <RadioGroup
                value={formState.method}
                onChange={(_, data) =>
                    setFormState((prev) => ({
                        ...emptyFormState(data.value as ConnectionMethod),
                        name: prev.name,
                        dataverseUrl: prev.dataverseUrl,
                        tokenCacheStorePath: prev.tokenCacheStorePath,
                    }))
                }
            >
                <Radio value="ClientCredentials" label="Client Credentials" />
                <Radio value="DeviceCode" label="Device Code" />
            </RadioGroup>

            <Field label="Connection name">
                <Input
                    value={formState.name}
                    onChange={(_, data) =>
                        setFormState((prev) => ({ ...prev, name: data.value }))
                    }
                />
            </Field>

            <Field label="Client ID / App ID">
                <Input
                    value={formState.clientId}
                    onChange={(_, data) =>
                        setFormState((prev) => ({ ...prev, clientId: data.value }))
                    }
                />
            </Field>

            {formState.method === "ClientCredentials" ? (
                <Field label="Client secret">
                    <Input
                        type="password"
                        value={formState.clientSecret}
                        onChange={(_, data) =>
                            setFormState((prev) => ({ ...prev, clientSecret: data.value }))
                        }
                    />
                </Field>
            ) : null}

            <Field label={formState.method === "ClientCredentials" ? "Tenant ID" : "Tenant ID (optional)"}>
                <Input
                    value={formState.tenantId}
                    onChange={(_, data) =>
                        setFormState((prev) => ({ ...prev, tenantId: data.value }))
                    }
                />
            </Field>

            <Field label="Dataverse URL">
                <Input
                    value={formState.dataverseUrl}
                    onChange={(_, data) =>
                        setFormState((prev) => ({ ...prev, dataverseUrl: data.value }))
                    }
                />
            </Field>

            <Field label="Token cache path (optional)">
                <Input
                    value={formState.tokenCacheStorePath}
                    onChange={(_, data) =>
                        setFormState((prev) => ({
                            ...prev,
                            tokenCacheStorePath: data.value,
                        }))
                    }
                />
            </Field>

            <Text size={200}>
                {formState.method === "DeviceCode"
                    ? "Device code sign-in will open in the browser flow when the connection is validated or used. The device code itself is still logged to the backend console."
                    : "Client credentials connections are validated immediately using the supplied client ID, secret, tenant, and Dataverse URL."}
            </Text>
        </div>
    );

    const createDisabled = validationErrorFor(createFormState) !== null;

    return (
        <div className={flyoutClasses} style={{ pointerEvents: isOpen ? "auto" : "none" }}>
            <div className={styles.flyoutHalf}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <Title3>Connections</Title3>
                        </div>
                        <Button
                            appearance="primary"
                            size="small"
                            icon={<AddCircleRegular />}
                            onClick={() => {
                                setCreateFormState(emptyFormState());
                                setCreateStatus(null);
                                setCreateOpen(true);
                            }}
                        >
                            New
                        </Button>
                    </div>
                    <Divider className={styles.sectionDivider} />
                    {connections.length === 0 ? (
                        <Text className={styles.emptyState}>No connections yet.</Text>
                    ) : (
                        <Tree size="small" aria-label="Connections List" className={styles.list}>
                            {connections.map((conn, index) => (
                                <TreeItem key={`conn-${index}`} itemType="leaf">
                                    <TreeItemLayout onClick={() => openEdit(conn, index)}>
                                        <div className={styles.connectionRow}>
                                            <Link24Filled
                                                style={{
                                                    color: tokens.colorPaletteGreenForeground1,
                                                }}
                                            />
                                            <span className={styles.connectionName}>{conn.name}</span>
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Open24Regular />}
                                                aria-label={`Open query for ${conn.name}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onOpenConnection(conn);
                                                }}
                                            />
                                        </div>
                                    </TreeItemLayout>
                                </TreeItem>
                            ))}
                        </Tree>
                    )}
                </div>
            </div>

            <ModalDialog
                open={createOpen}
                title="Create Connection"
                onClose={closeCreate}
                closeLabel="Cancel"
            >
                {renderForm(createFormState, setCreateFormState)}
                {createStatus ? (
                    <Text
                        style={{
                            color:
                                createStatus.type === "success"
                                    ? tokens.colorPaletteGreenForeground1
                                    : tokens.colorPaletteRedForeground1,
                        }}
                    >
                        {createStatus.message}
                    </Text>
                ) : null}
                <Button
                    appearance="primary"
                    onClick={handleCreateConnection}
                    disabled={createDisabled}
                >
                    Create Connection
                </Button>
            </ModalDialog>

            <ModalDialog
                open={editOpen}
                title="Edit Connection"
                onClose={closeEdit}
                closeLabel="Cancel"
            >
                {renderForm(editFormState, setEditFormState)}
                {editStatus ? (
                    <Text
                        style={{
                            color:
                                editStatus.type === "success"
                                    ? tokens.colorPaletteGreenForeground1
                                    : tokens.colorPaletteRedForeground1,
                        }}
                    >
                        {editStatus.message}
                    </Text>
                ) : null}
                <Button appearance="primary" onClick={handleSaveEdit}>
                    Save Changes
                </Button>
            </ModalDialog>
        </div>
    );
}
