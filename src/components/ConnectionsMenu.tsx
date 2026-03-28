import {
    Button,
    Divider,
    Field,
    Input,
    Radio,
    RadioGroup,
    Text,
    Title3,
} from "@fluentui/react-components";
import { AddCircleRegular, FolderAdd24Regular, Open24Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { combineClasses } from "../utility/class";
import {
    createConnection,
    createConnectionFolder,
    deleteConnection,
    deleteConnectionFolder,
    getDefaultConnection,
    listConnections,
    listConnectionTree,
    moveConnection,
    moveConnectionFolder,
    updateConnection,
    updateConnectionFolder,
    updateConnectionFolderColor,
} from "../binding/function";
import { Connection } from "../binding/model/Connection";
import { ConnectionFolderTreeItem, ConnectionTreeItem } from "../binding/model/ConnectionTreeItem";
import { RequestType } from "../binding/model/QVRequest";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { ModalDialog } from "./ModalDialog";
import { logError } from "../utility/logging";
import { ConnectionTreeList } from "./ConnectionTreeList";

type ConnectionMethod = "ClientCredentials" | "DeviceCode";

type ConnectionFormState = {
    id: string;
    method: ConnectionMethod;
    name: string;
    parentFolderId: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
    dataverseUrl: string;
    tokenCacheStorePath: string;
};

type FolderFormState = {
    name: string;
    parentFolderId: string;
};

const emptyFormState = (method: ConnectionMethod = "ClientCredentials"): ConnectionFormState => ({
    id: "",
    method,
    name: "",
    parentFolderId: "",
    clientId: "",
    clientSecret: "",
    tenantId: method === "DeviceCode" ? "organizations" : "",
    dataverseUrl: "",
    tokenCacheStorePath: "",
});

const emptyFolderFormState = (parentFolderId = ""): FolderFormState => ({
    name: "",
    parentFolderId,
});

const isClientCredentials = (
    connection: Connection
): connection is Connection & { auth: { method: "ClientCredentials"; clientSecret: string } } =>
    connection.auth.method === "ClientCredentials";

const toFormState = (connection: Connection): ConnectionFormState => ({
    id: connection.id ?? "",
    method: connection.auth.method,
    name: connection.name ?? "",
    parentFolderId: connection.parentFolderId ?? "",
    clientId: connection.auth.clientId ?? "",
    clientSecret: isClientCredentials(connection) ? connection.auth.clientSecret ?? "" : "",
    tenantId: connection.auth.tenantId ?? "",
    dataverseUrl: connection.auth.dataverseUrl ?? "",
    tokenCacheStorePath: connection.auth.tokenCacheStorePath ?? "",
});

const validationErrorFor = (state: ConnectionFormState): string | null => {
    if (!state.name.trim()) return "Connection name is required.";
    if (!state.id.trim()) return "Connection ID is required.";
    if (!state.clientId.trim()) return "Client ID is required.";
    if (!state.dataverseUrl.trim()) return "Dataverse URL is required.";

    if (state.method === "ClientCredentials") {
        if (!state.clientSecret.trim()) return "Client secret is required.";
        if (!state.tenantId.trim()) return "Tenant ID is required.";
    }

    return null;
};

const folderValidationErrorFor = (state: FolderFormState): string | null =>
    state.name.trim() ? null : "Folder name is required.";

const buildPayload = (state: ConnectionFormState) =>
    state.method === "ClientCredentials"
        ? {
              id: state.id.trim(),
              method: "ClientCredentials" as const,
              name: state.name.trim(),
              parentFolderId: state.parentFolderId || null,
              clientId: state.clientId.trim(),
              clientSecret: state.clientSecret,
              tenantId: state.tenantId.trim(),
              dataverseUrl: state.dataverseUrl.trim(),
              tokenCacheStorePath: state.tokenCacheStorePath.trim() || null,
          }
        : {
              id: state.id.trim(),
              method: "DeviceCode" as const,
              name: state.name.trim(),
              parentFolderId: state.parentFolderId || null,
              clientId: state.clientId.trim(),
              tenantId: state.tenantId.trim(),
              dataverseUrl: state.dataverseUrl.trim(),
              tokenCacheStorePath: state.tokenCacheStorePath.trim() || null,
          };

type FolderOption = {
    id: string;
    label: string;
};

const flattenFolderOptions = (items: ConnectionTreeItem[], depth = 0): FolderOption[] =>
    items.flatMap((item) => {
        if (item.kind !== "folder") return [];
        const prefix = depth > 0 ? `${"  ".repeat(depth)} ` : "";
        return [
            { id: item.id, label: `${prefix}${item.name}` },
            ...flattenFolderOptions(item.children, depth + 1),
        ];
    });

const findSiblingFolders = (
    items: ConnectionTreeItem[],
    folderId: string,
    parentFolderId?: string | null
): ConnectionFolderTreeItem[] => {
    const siblings = items.filter(
        (item): item is ConnectionFolderTreeItem =>
            item.kind === "folder" && (item.parentFolderId ?? null) === (parentFolderId ?? null)
    );
    if (siblings.some((folder) => folder.id === folderId)) {
        return siblings;
    }

    for (const item of items) {
        if (item.kind !== "folder") continue;
        const nested = findSiblingFolders(item.children, folderId, parentFolderId);
        if (nested.length) {
            return nested;
        }
    }

    return [];
};

export interface IConnectionsMenuProps {
    isOpen: boolean;
    onOpenConnection: (connection: Connection) => void;
}

export function ConnectionsMenu({ isOpen, onOpenConnection }: IConnectionsMenuProps) {
    const styles = useConnectionsMenuStyles();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [connectionTree, setConnectionTree] = useState<ConnectionTreeItem[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [editFolderOpen, setEditFolderOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [createStatus, setCreateStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [editStatus, setEditStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [folderStatus, setFolderStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [editFolderStatus, setEditFolderStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [createFormState, setCreateFormState] = useState<ConnectionFormState>(emptyFormState());
    const [editFormState, setEditFormState] = useState<ConnectionFormState>(emptyFormState());
    const [folderFormState, setFolderFormState] = useState<FolderFormState>(emptyFolderFormState());
    const [editFolderFormState, setEditFolderFormState] = useState<FolderFormState>(emptyFolderFormState());
    const [editFolderId, setEditFolderId] = useState<string | null>(null);
    const [connectionContextMenu, setConnectionContextMenu] = useState<{
        open: boolean;
        x: number;
        y: number;
        connection: Connection | null;
    }>({ open: false, x: 0, y: 0, connection: null });
    const [folderContextMenu, setFolderContextMenu] = useState<{
        open: boolean;
        x: number;
        y: number;
        folder: ConnectionFolderTreeItem | null;
    }>({ open: false, x: 0, y: 0, folder: null });
    const colorInputRef = useRef<HTMLInputElement | null>(null);
    const connectionContextMenuRef = useRef<HTMLDivElement | null>(null);
    const folderContextMenuRef = useRef<HTMLDivElement | null>(null);

    const flyoutClasses = combineClasses(styles.flyoutBase, isOpen && styles.flyoutOpen);
    const folderOptions = useMemo(() => flattenFolderOptions(connectionTree), [connectionTree]);
    const selectedContextConnection = connectionContextMenu.connection;
    const siblingConnections = useMemo(() => {
        if (!selectedContextConnection) {
            return [];
        }

        const parentFolderId = selectedContextConnection.parentFolderId ?? null;
        return connections.filter(
            (connection) => (connection.parentFolderId ?? null) === parentFolderId
        );
    }, [connections, selectedContextConnection]);
    const selectedContextConnectionIndex = siblingConnections.findIndex(
        (connection) => connection.id === selectedContextConnection?.id
    );
    const selectedContextFolder = folderContextMenu.folder;
    const siblingFolders = useMemo(() => {
        if (!selectedContextFolder) {
            return [];
        }

        return findSiblingFolders(
            connectionTree,
            selectedContextFolder.id,
            selectedContextFolder.parentFolderId ?? null
        );
    }, [connectionTree, selectedContextFolder]);
    const selectedContextFolderIndex = siblingFolders.findIndex(
        (folder) => folder.id === selectedContextFolder?.id
    );

    const loadData = async () => {
        try {
            const [connectionsResponse, treeResponse] = await Promise.all([
                listConnections(),
                listConnectionTree(),
            ]);

            if (connectionsResponse.success) setConnections(connectionsResponse.value);
            if (treeResponse.success) setConnectionTree(treeResponse.value);
        } catch (error) {
            logError("Failed to load connections", error, "queryverse::frontend::connections");
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    useEffect(() => {
        if (!folderContextMenu.open && !connectionContextMenu.open) return;

        const handleClose = (event: MouseEvent | KeyboardEvent) => {
            if (
                event instanceof MouseEvent &&
                (folderContextMenuRef.current?.contains(event.target as Node) ||
                    connectionContextMenuRef.current?.contains(event.target as Node))
            ) {
                return;
            }

            setConnectionContextMenu((prev) => ({ ...prev, open: false }));
            setFolderContextMenu((prev) => ({ ...prev, open: false }));
        };
        window.addEventListener("click", handleClose, true);
        window.addEventListener("contextmenu", handleClose, true);
        window.addEventListener("keydown", handleClose, true);
        return () => {
            window.removeEventListener("click", handleClose, true);
            window.removeEventListener("contextmenu", handleClose, true);
            window.removeEventListener("keydown", handleClose, true);
        };
    }, [connectionContextMenu.open, folderContextMenu.open]);

    const loadDefaultConnection = async (method: ConnectionMethod = "ClientCredentials") => {
        const connection = await getDefaultConnection();
        setCreateFormState({
            ...toFormState(connection),
            method,
            parentFolderId: "",
            tenantId: method === "DeviceCode" ? "organizations" : "",
            clientSecret: "",
        });
    };

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

    const closeCreateFolder = () => {
        setCreateFolderOpen(false);
        setFolderFormState(emptyFolderFormState());
        setFolderStatus(null);
    };

    const closeEditFolder = () => {
        setEditFolderOpen(false);
        setEditFolderId(null);
        setEditFolderFormState(emptyFolderFormState());
        setEditFolderStatus(null);
    };

    const openEdit = (connection: Connection) => {
        const index = connections.findIndex((item) => item.id === connection.id);
        if (index < 0) return;
        setConnectionContextMenu((prev) => ({ ...prev, open: false }));
        setEditIndex(index);
        setEditFormState(toFormState(connection));
        setEditStatus(null);
        setEditOpen(true);
    };

    const openEditFolder = (folder: ConnectionFolderTreeItem) => {
        setFolderContextMenu((prev) => ({ ...prev, open: false }));
        setEditFolderId(folder.id);
        setEditFolderFormState({
            name: folder.name ?? "",
            parentFolderId: folder.parentFolderId ?? "",
        });
        setEditFolderStatus(null);
        setEditFolderOpen(true);
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
                await loadData();
                setCreateStatus({ type: "success", message: response.message || "Connection validated." });
            } else {
                setCreateStatus({ type: "error", message: response.message || "Failed to create connection." });
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
                await loadData();
                setEditStatus({ type: "success", message: response.message || "Connection updated." });
            } else {
                setEditStatus({ type: "error", message: response.message || "Failed to update connection." });
            }
        } catch (error) {
            setEditStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to update connection.",
            });
        }
    };

    const handleCreateFolder = async () => {
        setFolderStatus(null);
        const validationError = folderValidationErrorFor(folderFormState);
        if (validationError) {
            setFolderStatus({ type: "error", message: validationError });
            return;
        }

        try {
            const response = await createConnectionFolder(
                folderFormState.name.trim(),
                folderFormState.parentFolderId || null
            );

            if (response.success) {
                await loadData();
                setFolderStatus({ type: "success", message: response.message || "Folder created." });
            } else {
                setFolderStatus({ type: "error", message: response.message || "Failed to create folder." });
            }
        } catch (error) {
            setFolderStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to create folder.",
            });
        }
    };

    const handleSaveFolderEdit = async () => {
        setEditFolderStatus(null);
        const validationError = folderValidationErrorFor(editFolderFormState);
        if (validationError) {
            setEditFolderStatus({ type: "error", message: validationError });
            return;
        }

        if (!editFolderId) {
            setEditFolderStatus({ type: "error", message: "No folder selected." });
            return;
        }

        try {
            const response = await updateConnectionFolder(
                editFolderId,
                editFolderFormState.name.trim(),
                editFolderFormState.parentFolderId || null
            );

            if (response.success) {
                await loadData();
                setEditFolderStatus({
                    type: "success",
                    message: response.message || "Folder updated.",
                });
            } else {
                setEditFolderStatus({
                    type: "error",
                    message: response.message || "Failed to update folder.",
                });
            }
        } catch (error) {
            setEditFolderStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to update folder.",
            });
        }
    };

    const openCreateConnectionInFolder = async (parentFolderId: string) => {
        setFolderContextMenu((prev) => ({ ...prev, open: false }));
        setCreateStatus(null);
        await loadDefaultConnection();
        setCreateFormState((prev) => ({
            ...prev,
            parentFolderId,
        }));
        setCreateOpen(true);
    };

    const handleDeleteFolder = async () => {
        if (!folderContextMenu.folder) return;

        const folder = folderContextMenu.folder;
        const shouldDelete = window.confirm(
            `Delete folder "${folder.name}" and all nested folders and connections?`
        );
        if (!shouldDelete) {
            return;
        }

        try {
            await deleteConnectionFolder(folder.id);
            setFolderContextMenu((prev) => ({ ...prev, open: false }));
            await loadData();
        } catch (error) {
            setFolderStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to delete folder.",
            });
        }
    };

    const handleDeleteConnection = async () => {
        const connection = connectionContextMenu.connection;
        if (!connection?.id) return;

        const shouldDelete = window.confirm(
            `Delete connection "${connection.name}"?`
        );
        if (!shouldDelete) {
            return;
        }

        try {
            await deleteConnection(connection.id);
            setConnectionContextMenu((prev) => ({ ...prev, open: false }));
            if (connections[editIndex ?? -1]?.id === connection.id) {
                closeEdit();
            }
            await loadData();
        } catch (error) {
            setEditStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to delete connection.",
            });
        }
    };

    const handleMoveConnection = async (direction: "up" | "down") => {
        const connection = connectionContextMenu.connection;
        if (!connection?.id) return;

        try {
            await moveConnection(connection.id, direction);
            await loadData();
        } catch (error) {
            setEditStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to reorder connection.",
            });
        }
    };

    const handleMoveFolder = async (direction: "up" | "down") => {
        const folder = folderContextMenu.folder;
        if (!folder?.id) return;

        try {
            await moveConnectionFolder(folder.id, direction);
            await loadData();
        } catch (error) {
            setEditFolderStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Failed to reorder folder.",
            });
        }
    };

    const handleAssignFolderColor = () => {
        setFolderContextMenu((prev) => ({ ...prev, open: false }));
        colorInputRef.current?.click();
    };

    const handleFolderColorChange = async (color: string) => {
        if (!folderContextMenu.folder) return;
        await updateConnectionFolderColor(folderContextMenu.folder.id, color);
        await loadData();
    };

    const handleClearFolderColor = async () => {
        if (!folderContextMenu.folder) return;
        await updateConnectionFolderColor(folderContextMenu.folder.id, null);
        setFolderContextMenu((prev) => ({ ...prev, open: false }));
        await loadData();
    };

    const renderFolderSelect = (
        value: string,
        onChange: (value: string) => void
    ) => (
        <Field label="Folder">
            <select
                className={styles.folderSelect}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">Root</option>
                {folderOptions.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                        {folder.label}
                    </option>
                ))}
            </select>
        </Field>
    );

    const renderForm = (
        formState: ConnectionFormState,
        setFormState: Dispatch<SetStateAction<ConnectionFormState>>
    ) => (
        <div className={styles.modalForm}>
            <Field label="Connection ID">
                <Input value={formState.id} disabled />
            </Field>

            <RadioGroup
                value={formState.method}
                onChange={(_, data) =>
                    setFormState((prev) => ({
                        ...emptyFormState(data.value as ConnectionMethod),
                        id: prev.id,
                        name: prev.name,
                        parentFolderId: prev.parentFolderId,
                        clientId: prev.clientId,
                        dataverseUrl: prev.dataverseUrl,
                        tokenCacheStorePath: prev.tokenCacheStorePath,
                    }))
                }
            >
                <Radio value="ClientCredentials" label="Client Credentials" />
                <Radio value="DeviceCode" label="Device Code" />
            </RadioGroup>

            <Field label="Connection name">
                <Input value={formState.name} onChange={(_, data) => setFormState((prev) => ({ ...prev, name: data.value }))} />
            </Field>

            {renderFolderSelect(formState.parentFolderId, (value) =>
                setFormState((prev) => ({ ...prev, parentFolderId: value }))
            )}

            <Field label="Client ID / App ID">
                <Input value={formState.clientId} onChange={(_, data) => setFormState((prev) => ({ ...prev, clientId: data.value }))} />
            </Field>

            {formState.method === "ClientCredentials" ? (
                <Field label="Client secret">
                    <Input
                        type="password"
                        value={formState.clientSecret}
                        onChange={(_, data) => setFormState((prev) => ({ ...prev, clientSecret: data.value }))}
                    />
                </Field>
            ) : null}

            <Field label="Tenant ID">
                <Input
                    value={formState.tenantId}
                    disabled={formState.method === "DeviceCode"}
                    onChange={(_, data) => setFormState((prev) => ({ ...prev, tenantId: data.value }))}
                />
            </Field>

            <Field label="Dataverse URL">
                <Input value={formState.dataverseUrl} onChange={(_, data) => setFormState((prev) => ({ ...prev, dataverseUrl: data.value }))} />
            </Field>

            <Field label="Token cache path (optional)">
                <Input
                    value={formState.tokenCacheStorePath}
                    onChange={(_, data) => setFormState((prev) => ({ ...prev, tokenCacheStorePath: data.value }))}
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
    const folderCreateDisabled = folderValidationErrorFor(folderFormState) !== null;

    return (
        <div className={flyoutClasses} style={{ pointerEvents: isOpen ? "auto" : "none" }}>
            <div className={styles.flyoutHalf}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <Title3>Connections</Title3>
                        </div>
                        <div className={styles.sectionHeaderActions}>
                            <Button
                                appearance="secondary"
                                size="small"
                                icon={<FolderAdd24Regular />}
                                onClick={() => {
                                    setFolderStatus(null);
                                    setFolderFormState(emptyFolderFormState());
                                    setCreateFolderOpen(true);
                                }}
                            >
                                Folder
                            </Button>
                            <Button
                                appearance="primary"
                                size="small"
                                icon={<AddCircleRegular />}
                                onClick={async () => {
                                    setCreateStatus(null);
                                    await loadDefaultConnection();
                                    setCreateOpen(true);
                                }}
                            >
                                New
                            </Button>
                        </div>
                    </div>
                    <Divider className={styles.sectionDivider} />
                    {connectionTree.length === 0 ? (
                        <Text className={styles.emptyState}>No connections yet.</Text>
                    ) : (
                        <div className={styles.list}>
                            <ConnectionTreeList
                                items={connectionTree}
                                onConnectionSelect={(connection) => openEdit(connection)}
                                onConnectionContextMenu={(connection, x, y) => {
                                    setFolderContextMenu((prev) => ({ ...prev, open: false }));
                                    setConnectionContextMenu({
                                        open: true,
                                        x,
                                        y,
                                        connection,
                                    });
                                }}
                                onFolderContextMenu={(folder, x, y) => {
                                    setConnectionContextMenu((prev) => ({ ...prev, open: false }));
                                    setFolderContextMenu({ open: true, x, y, folder });
                                }}
                                renderConnectionActions={(connection) => (
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Open24Regular />}
                                        aria-label={`Open query for ${connection.name}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onOpenConnection(connection);
                                        }}
                                    />
                                )}
                                highlightedConnectionId={
                                    connectionContextMenu.connection?.id ??
                                    editFormState.id ??
                                    null
                                }
                                highlightedFolderId={
                                    folderContextMenu.folder?.id ??
                                    editFolderId ??
                                    null
                                }
                            />
                        </div>
                    )}
                </div>
            </div>

            <input
                ref={colorInputRef}
                type="color"
                style={{ display: "none" }}
                onChange={(event) => void handleFolderColorChange(event.target.value)}
            />

            {connectionContextMenu.open && connectionContextMenu.connection ? (
                <div
                    ref={connectionContextMenuRef}
                    className={styles.contextMenu}
                    style={{ left: connectionContextMenu.x, top: connectionContextMenu.y }}
                >
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => {
                            onOpenConnection(connectionContextMenu.connection as Connection);
                            setConnectionContextMenu((prev) => ({ ...prev, open: false }));
                        }}
                    >
                        Open query
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => openEdit(connectionContextMenu.connection as Connection)}
                    >
                        Edit connection
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        disabled={selectedContextConnectionIndex <= 0}
                        onClick={() => void handleMoveConnection("up")}
                    >
                        Move up
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        disabled={
                            selectedContextConnectionIndex === -1 ||
                            selectedContextConnectionIndex >= siblingConnections.length - 1
                        }
                        onClick={() => void handleMoveConnection("down")}
                    >
                        Move down
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => void handleDeleteConnection()}
                    >
                        Delete connection
                    </Button>
                </div>
            ) : null}

            {folderContextMenu.open && folderContextMenu.folder ? (
                <div
                    ref={folderContextMenuRef}
                    className={styles.contextMenu}
                    style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
                >
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => void openCreateConnectionInFolder(folderContextMenu.folder?.id ?? "")}
                    >
                        Add connection
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => openEditFolder(folderContextMenu.folder as ConnectionFolderTreeItem)}
                    >
                        Edit folder
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => {
                            setFolderContextMenu((prev) => ({ ...prev, open: false }));
                            setFolderStatus(null);
                            setFolderFormState(emptyFolderFormState(folderContextMenu.folder?.id ?? ""));
                            setCreateFolderOpen(true);
                        }}
                    >
                        New subfolder
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        disabled={selectedContextFolderIndex <= 0}
                        onClick={() => void handleMoveFolder("up")}
                    >
                        Move up
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        disabled={
                            selectedContextFolderIndex === -1 ||
                            selectedContextFolderIndex >= siblingFolders.length - 1
                        }
                        onClick={() => void handleMoveFolder("down")}
                    >
                        Move down
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={handleAssignFolderColor}
                    >
                        Assign color
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => void handleClearFolderColor()}
                    >
                        Clear color
                    </Button>
                    <Button
                        appearance="subtle"
                        className={styles.contextMenuButton}
                        onClick={() => void handleDeleteFolder()}
                    >
                        Delete folder
                    </Button>
                </div>
            ) : null}

            <ModalDialog open={createOpen} title="Create Connection" onClose={closeCreate} closeLabel="Cancel">
                {renderForm(createFormState, setCreateFormState)}
                <div className={styles.modalStatusSlot}>
                    {createStatus ? (
                        <Text className={createStatus.type === "success" ? styles.modalStatusSuccess : styles.modalStatusError}>
                            {createStatus.message}
                        </Text>
                    ) : null}
                </div>
                <Button appearance="primary" onClick={handleCreateConnection} disabled={createDisabled}>
                    Create Connection
                </Button>
            </ModalDialog>

            <ModalDialog open={editOpen} title={`Edit Connection${editFormState.name ? `: ${editFormState.name}` : ""}`} onClose={closeEdit} closeLabel="Cancel">
                {renderForm(editFormState, setEditFormState)}
                <div className={styles.modalStatusSlot}>
                    {editStatus ? (
                        <Text className={editStatus.type === "success" ? styles.modalStatusSuccess : styles.modalStatusError}>
                            {editStatus.message}
                        </Text>
                    ) : null}
                </div>
                <Button appearance="primary" onClick={handleSaveEdit}>
                    Save Changes
                </Button>
            </ModalDialog>

            <ModalDialog open={createFolderOpen} title="Create Folder" onClose={closeCreateFolder} closeLabel="Cancel">
                <div className={styles.modalForm}>
                    <Field label="Folder name">
                        <Input
                            value={folderFormState.name}
                            onChange={(_, data) => setFolderFormState((prev) => ({ ...prev, name: data.value }))}
                        />
                    </Field>
                    {renderFolderSelect(folderFormState.parentFolderId, (value) =>
                        setFolderFormState((prev) => ({ ...prev, parentFolderId: value }))
                    )}
                </div>
                <div className={styles.modalStatusSlot}>
                    {folderStatus ? (
                        <Text className={folderStatus.type === "success" ? styles.modalStatusSuccess : styles.modalStatusError}>
                            {folderStatus.message}
                        </Text>
                    ) : null}
                </div>
                <Button appearance="primary" onClick={handleCreateFolder} disabled={folderCreateDisabled}>
                    Create Folder
                </Button>
            </ModalDialog>

            <ModalDialog open={editFolderOpen} title={`Edit Folder${editFolderFormState.name ? `: ${editFolderFormState.name}` : ""}`} onClose={closeEditFolder} closeLabel="Cancel">
                <div className={styles.modalForm}>
                    <Field label="Folder name">
                        <Input
                            value={editFolderFormState.name}
                            onChange={(_, data) => setEditFolderFormState((prev) => ({ ...prev, name: data.value }))}
                        />
                    </Field>
                    {renderFolderSelect(editFolderFormState.parentFolderId, (value) =>
                        setEditFolderFormState((prev) => ({ ...prev, parentFolderId: value }))
                    )}
                </div>
                <div className={styles.modalStatusSlot}>
                    {editFolderStatus ? (
                        <Text className={editFolderStatus.type === "success" ? styles.modalStatusSuccess : styles.modalStatusError}>
                            {editFolderStatus.message}
                        </Text>
                    ) : null}
                </div>
                <Button appearance="primary" onClick={handleSaveFolderEdit} disabled={folderValidationErrorFor(editFolderFormState) !== null}>
                    Save Changes
                </Button>
            </ModalDialog>
        </div>
    );
}
