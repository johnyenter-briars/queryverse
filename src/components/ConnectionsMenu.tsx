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
} from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { createConnection, listConnections, updateConnection } from "../binding/backend";
import { Connection } from "../binding/model/Connection";
import { RequestType } from "../binding/model/QVRequest";
import { useEffect, useState } from "react";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { ModalDialog } from "./ModalDialog";

export interface IConnectionsMenuProps {
    isOpen: boolean
};

export function ConnectionsMenu({ isOpen }: IConnectionsMenuProps) {
    const styles = useConnectionsMenuStyles();
    const [createOpen, setCreateOpen] = useState(false);
    const [createMethod, setCreateMethod] = useState<"ClientCredentials" | "AuthorizationCode">("ClientCredentials");
    const [createStatus, setCreateStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editStatus, setEditStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [formState, setFormState] = useState({
        name: "",
        clientId: "",
        clientSecret: "",
        tenantId: "",
        scope: "",
        authorizationCode: "",
        redirectUri: "",
        username: "",
        password: "",
        d365Url: "",
    });
    const [editFormState, setEditFormState] = useState({
        method: "ClientCredentials" as "ClientCredentials" | "AuthorizationCode",
        name: "",
        clientId: "",
        clientSecret: "",
        tenantId: "",
        scope: "",
        authorizationCode: "",
        redirectUri: "",
        username: "",
        password: "",
        d365Url: "",
    });

    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const [connections, setConnections] = useState<Connection[]>([]);

    const loadConnections = async () => {
        try {
            const response = await listConnections();
            if (response.success) {
                setConnections(response.value);
            }
        } catch (error) {
            console.error("Failed to load connections", error);
        }
    };

    useEffect(() => {
        loadConnections();
    }, []);

    const resetForm = () => {
        setFormState({
            name: "",
            clientId: "",
            clientSecret: "",
            tenantId: "",
            scope: "",
            authorizationCode: "",
            redirectUri: "",
            username: "",
            password: "",
            d365Url: "",
        });
        setCreateMethod("ClientCredentials");
        setCreateStatus(null);
    };

    const handleCloseCreate = () => {
        setCreateOpen(false);
        resetForm();
    };

    const handleCloseEdit = () => {
        setEditOpen(false);
        setEditIndex(null);
        setEditStatus(null);
    };

    const handleOpenEdit = (conn: Connection, index: number) => {
        setEditStatus(null);
        setEditIndex(index);

        if (conn.method === "ClientCredentials") {
            setEditFormState({
                method: "ClientCredentials",
                name: conn.name ?? "",
                clientId: conn.clientId ?? "",
                clientSecret: conn.clientSecret ?? "",
                tenantId: conn.tenantId ?? "",
                scope: conn.scope ?? "",
                authorizationCode: "",
                redirectUri: "",
                username: "",
                password: "",
                d365Url: conn.d365Url ?? "",
            });
        } else {
            setEditFormState({
                method: "AuthorizationCode",
                name: conn.name ?? "",
                clientId: "",
                clientSecret: "",
                tenantId: "",
                scope: "",
                authorizationCode: "",
                redirectUri: "",
                username: "",
                password: "",
                d365Url: conn.d365Url ?? "",
            });
        }

        setEditOpen(true);
    };

    const handleCreateConnection = async () => {
        setCreateStatus(null);

        const payload =
            createMethod === "ClientCredentials"
                ? {
                    method: "ClientCredentials" as const,
                    name: formState.name.trim(),
                    clientId: formState.clientId.trim(),
                    clientSecret: formState.clientSecret,
                    tenantId: formState.tenantId.trim(),
                    scope: formState.scope.trim(),
                    d365Url: formState.d365Url.trim(),
                }
                : {
                    method: "AuthorizationCode" as const,
                    name: formState.name.trim(),
                    clientId: formState.clientId.trim(),
                    clientSecret: formState.clientSecret,
                    tenantId: formState.tenantId.trim(),
                    scope: formState.scope.trim(),
                    authorizationCode: formState.authorizationCode.trim(),
                    redirectUri: formState.redirectUri.trim(),
                    username: formState.username.trim(),
                    password: formState.password,
                    d365Url: formState.d365Url.trim(),
                };

        try {
            const response = await createConnection({
                requestType: RequestType.Create,
                value: payload,
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

    const getEditValidationError = () => {
        if (!editFormState.name.trim()) {
            return "Connection name is required.";
        }

        if (!editFormState.d365Url.trim()) {
            return "D365 URL is required.";
        }

        if (editFormState.method === "ClientCredentials") {
            if (!editFormState.clientId.trim()) {
                return "Client ID is required.";
            }
            if (!editFormState.clientSecret.trim()) {
                return "Client secret is required.";
            }
            if (!editFormState.tenantId.trim()) {
                return "Tenant ID is required.";
            }
            if (!editFormState.scope.trim()) {
                return "Scope is required.";
            }
        } else {
            if (!editFormState.clientId.trim()) {
                return "Client ID is required.";
            }
            if (!editFormState.clientSecret.trim()) {
                return "Client secret is required.";
            }
            if (!editFormState.tenantId.trim()) {
                return "Tenant ID is required.";
            }
            if (!editFormState.scope.trim()) {
                return "Scope is required.";
            }
            if (!editFormState.redirectUri.trim()) {
                return "Redirect URI is required.";
            }
            if (!editFormState.username.trim()) {
                return "Username is required.";
            }
            if (!editFormState.password.trim()) {
                return "Password is required.";
            }
        }

        return null;
    };

    const handleSaveEdit = async () => {
        setEditStatus(null);

        const validationError = getEditValidationError();
        if (validationError) {
            setEditStatus({
                type: "error",
                message: validationError,
            });
            return;
        }

        if (editIndex === null) {
            setEditStatus({
                type: "error",
                message: "No connection selected.",
            });
            return;
        }

        const targetIndex = editIndex;
        const payload =
            editFormState.method === "ClientCredentials"
                ? {
                    method: "ClientCredentials" as const,
                    name: editFormState.name.trim(),
                    clientId: editFormState.clientId.trim(),
                    clientSecret: editFormState.clientSecret,
                    tenantId: editFormState.tenantId.trim(),
                    scope: editFormState.scope.trim(),
                    d365Url: editFormState.d365Url.trim(),
                }
                : {
                    method: "AuthorizationCode" as const,
                    name: editFormState.name.trim(),
                    clientId: editFormState.clientId.trim(),
                    clientSecret: editFormState.clientSecret,
                    tenantId: editFormState.tenantId.trim(),
                    scope: editFormState.scope.trim(),
                    authorizationCode: editFormState.authorizationCode.trim(),
                    redirectUri: editFormState.redirectUri.trim(),
                    username: editFormState.username.trim(),
                    password: editFormState.password,
                    d365Url: editFormState.d365Url.trim(),
                };

        try {
            const response = await updateConnection({
                id: connections[targetIndex]?.id ?? null,
                index: targetIndex,
                payload,
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

    const isCreateDisabled =
        !formState.name.trim() ||
        !formState.clientId.trim() ||
        !formState.clientSecret.trim() ||
        !formState.tenantId.trim() ||
        !formState.scope.trim() ||
        !formState.d365Url.trim() ||
        (createMethod === "AuthorizationCode" &&
            (!formState.redirectUri.trim() ||
                !formState.username.trim() ||
                !formState.password.trim()));

    return (
        <div
            className={flyoutClasses}
            style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        >
            <div className={`${styles.flyoutHalf}`}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <Title3>Connections</Title3>
                            <Text className={styles.sectionSubtitle}>
                                Validate and manage saved connections.
                            </Text>
                        </div>
                        <Button
                            appearance="primary"
                            size="small"
                            icon={<AddCircleRegular />}
                            onClick={() => {
                                resetForm();
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
                                    <TreeItemLayout
                                        onClick={() => handleOpenEdit(conn, index)}
                                    >
                                        <div className={styles.connectionRow}>
                                            <Link24Filled
                                                style={{ color: tokens.colorPaletteGreenForeground1 }}
                                            />
                                            <span className={styles.connectionName}>{conn.name}</span>
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
                onClose={handleCloseCreate}
                closeLabel="Cancel"
            >
                <div style={{ display: "grid", gap: "12px" }}>
                    <RadioGroup
                        value={createMethod}
                        onChange={(_, data) =>
                            setCreateMethod(data.value as "ClientCredentials" | "AuthorizationCode")
                        }
                    >
                        <Radio value="AuthorizationCode" label="Authorization Code" />
                        <Radio value="ClientCredentials" label="Client Credentials" />
                    </RadioGroup>

                    <Field label="Connection name">
                        <Input
                            value={formState.name}
                            onChange={(_, data) => setFormState((prev) => ({ ...prev, name: data.value }))}
                        />
                    </Field>
                    <Field label="Client ID">
                        <Input
                            value={formState.clientId}
                            onChange={(_, data) => setFormState((prev) => ({ ...prev, clientId: data.value }))}
                        />
                    </Field>
                    <Field label="Client secret">
                        <Input
                            type="password"
                            value={formState.clientSecret}
                            onChange={(_, data) => setFormState((prev) => ({ ...prev, clientSecret: data.value }))}
                        />
                    </Field>
                    <Field label="Tenant ID">
                        <Input
                            value={formState.tenantId}
                            onChange={(_, data) => setFormState((prev) => ({ ...prev, tenantId: data.value }))}
                        />
                    </Field>
                    <Field label="Scope">
                        <Input
                            value={formState.scope}
                            onChange={(_, data) => setFormState((prev) => ({ ...prev, scope: data.value }))}
                        />
                    </Field>
                    <Field label="D365 URL">
                        <Input
                            value={formState.d365Url}
                            onChange={(_, data) => setFormState((prev) => ({ ...prev, d365Url: data.value }))}
                        />
                    </Field>

                    {createMethod === "AuthorizationCode" ? (
                        <>
                            <Field label="Authorization code">
                                <Input
                                    value={formState.authorizationCode}
                                    onChange={(_, data) =>
                                        setFormState((prev) => ({ ...prev, authorizationCode: data.value }))
                                    }
                                />
                            </Field>
                            <Field label="Redirect URI">
                                <Input
                                    value={formState.redirectUri}
                                    onChange={(_, data) =>
                                        setFormState((prev) => ({ ...prev, redirectUri: data.value }))
                                    }
                                />
                            </Field>
                            <Field label="Username">
                                <Input
                                    value={formState.username}
                                    onChange={(_, data) =>
                                        setFormState((prev) => ({ ...prev, username: data.value }))
                                    }
                                />
                            </Field>
                            <Field label="Password">
                                <Input
                                    type="password"
                                    value={formState.password}
                                    onChange={(_, data) =>
                                        setFormState((prev) => ({ ...prev, password: data.value }))
                                    }
                                />
                            </Field>
                        </>
                    ) : null}

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
                        disabled={isCreateDisabled}
                    >
                        Create Connection
                    </Button>
                </div>
            </ModalDialog>

            <ModalDialog
                open={editOpen}
                title="Edit Connection"
                onClose={handleCloseEdit}
                closeLabel="Cancel"
            >
                <div style={{ display: "grid", gap: "12px" }}>
                    <Field label="Connection name">
                        <Input
                            value={editFormState.name}
                            onChange={(_, data) => setEditFormState((prev) => ({ ...prev, name: data.value }))}
                        />
                    </Field>

                    {editFormState.method === "ClientCredentials" ? (
                        <>
                            <Field label="Client ID">
                                <Input
                                    value={editFormState.clientId}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, clientId: data.value }))}
                                />
                            </Field>
                            <Field label="Client secret">
                                <Input
                                    type="password"
                                    value={editFormState.clientSecret}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, clientSecret: data.value }))}
                                />
                            </Field>
                            <Field label="Tenant ID">
                                <Input
                                    value={editFormState.tenantId}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, tenantId: data.value }))}
                                />
                            </Field>
                            <Field label="Scope">
                                <Input
                                    value={editFormState.scope}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, scope: data.value }))}
                                />
                            </Field>
                        </>
                    ) : (
                        <>
                            <Field label="Client ID">
                                <Input
                                    value={editFormState.clientId}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, clientId: data.value }))}
                                />
                            </Field>
                            <Field label="Client secret">
                                <Input
                                    type="password"
                                    value={editFormState.clientSecret}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, clientSecret: data.value }))}
                                />
                            </Field>
                            <Field label="Tenant ID">
                                <Input
                                    value={editFormState.tenantId}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, tenantId: data.value }))}
                                />
                            </Field>
                            <Field label="Scope">
                                <Input
                                    value={editFormState.scope}
                                    onChange={(_, data) => setEditFormState((prev) => ({ ...prev, scope: data.value }))}
                                />
                            </Field>
                            <Field label="Authorization code">
                                <Input
                                    value={editFormState.authorizationCode}
                                    onChange={(_, data) =>
                                        setEditFormState((prev) => ({ ...prev, authorizationCode: data.value }))
                                    }
                                />
                            </Field>
                            <Field label="Redirect URI">
                                <Input
                                    value={editFormState.redirectUri}
                                    onChange={(_, data) =>
                                        setEditFormState((prev) => ({ ...prev, redirectUri: data.value }))
                                    }
                                />
                            </Field>
                            <Field label="Username">
                                <Input
                                    value={editFormState.username}
                                    onChange={(_, data) =>
                                        setEditFormState((prev) => ({ ...prev, username: data.value }))
                                    }
                                />
                            </Field>
                            <Field label="Password">
                                <Input
                                    type="password"
                                    value={editFormState.password}
                                    onChange={(_, data) =>
                                        setEditFormState((prev) => ({ ...prev, password: data.value }))
                                    }
                                />
                            </Field>
                        </>
                    )}

                    <Field label="D365 URL">
                        <Input
                            value={editFormState.d365Url}
                            onChange={(_, data) => setEditFormState((prev) => ({ ...prev, d365Url: data.value }))}
                        />
                    </Field>

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
                </div>
            </ModalDialog>

        </div>
    );
}
