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
    Table24Filled,
    FolderOpen24Filled,
    AddCircleRegular,
} from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { createConnection, listConnections } from "../binding/backend";
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

    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const mockSchema = [
        { name: "d365 dev", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 qa", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 prod", tables: ["systemuser", "account", "contact", "incident"] },
    ];

    const [connections, setConnections] = useState<Connection[]>([]);

    useEffect(() => {
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
                <Title3 className="mb-2">Connections</Title3>
                <Button
                    size="large"
                    icon={<AddCircleRegular />}
                    onClick={() => {
                        resetForm();
                        setCreateOpen(true);
                    }}
                />
                <Divider />
                <Tree size="small" aria-label="Connections List">
                    {connections.map((conn, index) => (
                        <TreeItem key={`conn-${index}`} itemType="leaf">
                            <TreeItemLayout>
                                <FolderOpen24Filled
                                    style={{ color: tokens.colorPaletteGreenForeground1 }}
                                />
                                {conn.name}
                            </TreeItemLayout>
                        </TreeItem>
                    ))}
                </Tree>
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

            <div className={`${styles.flyoutHalf}`}>
                <Title3 className="mb-2">Schema Explorer</Title3>
                <Divider />
                <Tree size="small" aria-label="Database Schema">
                    {mockSchema.map((db, dbIndex) => (
                        <TreeItem key={`db-${dbIndex}`} itemType="branch">
                            <TreeItemLayout><FolderOpen24Filled /> {db.name}</TreeItemLayout>
                            <Tree>
                                {db.tables.map((table, tableIndex) => (
                                    <TreeItem key={`table-${dbIndex}-${tableIndex}`} itemType="leaf">
                                        <TreeItemLayout><Table24Filled /> {table}</TreeItemLayout>
                                    </TreeItem>
                                ))}
                            </Tree>
                        </TreeItem>
                    ))}
                </Tree>
            </div>
        </div>
    );
}
