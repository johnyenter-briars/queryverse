import { invoke } from "@tauri-apps/api/core";
import { CreateConnectionResponse } from "./model/CreateConnectionResponse";
import { CreateConnectionRequest } from "./model/CreateConnectionRequest";
import { UpdateConnectionRequest } from "./model/UpdateConnectionRequest";
import { UpdateConnectionResponse } from "./model/UpdateConnectionResponse";
import { FetchXmlPreview } from "./model/FetchXmlPreview";
import { ListConnectionsResponse } from "./model/ListConnectionsResponse";
import { ExecuteSqlRequest } from "./model/ExecuteSqlRequest";
import { EntityDefinition } from "./model/EntityDefinition";
import { EntityAttribute } from "./model/EntityAttribute";
import { EntityRelationship } from "./model/EntityRelationship";
import { SetConnectionRequest } from "./model/SetConnectionRequest";
import { ExecuteSqlResponse } from "./model/ExecuteSqlResponse";
import { MultipleResponse } from "./model/MultipleResponse";
import { OpenSqlFileResponse } from "./model/OpenSqlFileResponse";
import { SaveSqlFileRequest } from "./model/SaveSqlFileRequest";
import { SaveSqlFileAsRequest } from "./model/SaveSqlFileAsRequest";
import { SaveSqlFileAsResponse } from "./model/SaveSqlFileAsResponse";
import { LaunchContext } from "./model/LaunchContext";
import { Settings } from "./model/Settings";
import { SettingsResponse } from "./model/SettingsResponse";
import { UpdateSqlPreviewResponse } from "./model/UpdateSqlPreviewResponse";
import { UpdateSqlJobStartResponse } from "./model/UpdateSqlJobStartResponse";
import { DeleteSqlPreviewResponse } from "./model/DeleteSqlPreviewResponse";
import { DeleteSqlExecuteResponse } from "./model/DeleteSqlExecuteResponse";
import { Connection } from "./model/Connection";
import { BackgroundJobStatusResponse } from "./model/BackgroundJobStatusResponse";
import { logDebug } from "../utility/logging";

const summarizeResponse = (response: unknown): unknown => {
    if (!response || typeof response !== "object") {
        return response;
    }

    const raw = response as Record<string, unknown>;
    const summary: Record<string, unknown> = {};

    if ("success" in raw) summary.success = raw.success;
    if ("message" in raw) summary.message = raw.message;
    if ("count" in raw) summary.count = raw.count;
    if ("updated" in raw) summary.updated = raw.updated;
    if ("deleted" in raw) summary.deleted = raw.deleted;
    if ("failed" in raw) summary.failed = raw.failed;
    if ("token" in raw) summary.token = "[redacted]";
    if ("jobId" in raw) summary.jobId = "[redacted]";
    if ("state" in raw) summary.state = raw.state;
    if ("processed" in raw) summary.processed = raw.processed;
    if ("total" in raw) summary.total = raw.total;

    return Object.keys(summary).length === 0 ? "[object]" : summary;
};

const logBindingResponse = (command: string, response: unknown): void => {
    logDebug(
        `${command} response`,
        summarizeResponse(response),
        "queryverse::frontend::binding"
    );
};

export const executeSql = async (
    sql: string
): Promise<ExecuteSqlResponse> => {
    const response: ExecuteSqlResponse = await invoke("execute_sql", {
        request: {
            sql,
        } satisfies ExecuteSqlRequest,
    });

    logBindingResponse("execute_sql", response);

    return response;
};

export const previewFetchXml = async (sql: string): Promise<FetchXmlPreview> => {
    const response: FetchXmlPreview = await invoke("parse_sql_to_fetchxml", {
        sql,
    });

    logBindingResponse("parse_sql_to_fetchxml", response);

    return response;
};

export const createConnection = async (
    connectionRequest: CreateConnectionRequest
): Promise<CreateConnectionResponse> => {
    const response: CreateConnectionResponse = await invoke("create_connection", {
        connectionRequest: connectionRequest,
    });

    logBindingResponse("create_connection", response);

    return response;
};

export const getDefaultConnection = async (): Promise<Connection> => {
    const response: Connection = await invoke("get_default_connection");

    logBindingResponse("get_default_connection", response);

    return response;
};

export const listConnections = async (): Promise<ListConnectionsResponse> => {
    const response: ListConnectionsResponse = await invoke("list_connections");

    logBindingResponse("list_connections", response);

    return response;
};

export const updateConnection = async (
    connectionRequest: UpdateConnectionRequest
): Promise<UpdateConnectionResponse> => {
    const response: UpdateConnectionResponse = await invoke("update_connection", {
        connectionRequest: connectionRequest,
    });

    logBindingResponse("update_connection", response);

    return response;
};

export const setConnection = async (connectionId: string): Promise<void> => {
    await invoke("set_connection", {
        request: {
            connectionId,
        } satisfies SetConnectionRequest,
    });
};

export const listEntityDefinitions = async (): Promise<
    MultipleResponse<EntityDefinition>
> => {
    const response: MultipleResponse<EntityDefinition> = await invoke(
        "list_entity_definitions"
    );

    logBindingResponse("list_entity_definitions", response);

    return response;
};

export const listEntityAttributes = async (
    logicalName: string
): Promise<MultipleResponse<EntityAttribute>> => {
    const response: MultipleResponse<EntityAttribute> = await invoke(
        "list_entity_attributes",
        { logicalName }
    );

    logBindingResponse("list_entity_attributes", response);

    return response;
};

export const listEntityRelationships = async (
    logicalName: string
): Promise<MultipleResponse<EntityRelationship>> => {
    const response: MultipleResponse<EntityRelationship> = await invoke(
        "list_entity_relationships",
        { logicalName }
    );

    logBindingResponse("list_entity_relationships", response);

    return response;
};

export const openSqlFile = async (): Promise<OpenSqlFileResponse | null> => {
    const response: OpenSqlFileResponse | null = await invoke("open_sql_file");

    logBindingResponse("open_sql_file", response);

    return response;
};

export const openSqlFilePath = async (path: string): Promise<OpenSqlFileResponse> => {
    const response: OpenSqlFileResponse = await invoke("open_sql_file_path", {
        path,
    });

    logBindingResponse("open_sql_file_path", response);

    return response;
};

export const saveSqlFile = async (
    request: SaveSqlFileRequest
): Promise<void> => {
    await invoke("save_sql_file", { request });
};

export const saveSqlFileAs = async (
    request: SaveSqlFileAsRequest
): Promise<SaveSqlFileAsResponse | null> => {
    const response: SaveSqlFileAsResponse | null = await invoke("save_sql_file_as", {
        request,
    });

    logBindingResponse("save_sql_file_as", response);

    return response;
};

export const getLaunchContext = async (): Promise<LaunchContext> => {
    const response: LaunchContext = await invoke("get_launch_context");

    logBindingResponse("get_launch_context", response);

    return response;
};

export const getSettings = async (): Promise<SettingsResponse> => {
    const response: SettingsResponse = await invoke("get_settings");

    logBindingResponse("get_settings", response);

    return response;
};

export const saveSettings = async (settings: Settings): Promise<SettingsResponse> => {
    const response: SettingsResponse = await invoke("save_settings", { settings });

    logBindingResponse("save_settings", response);

    return response;
};

export const prepareUpdateSql = async (
    sql: string
): Promise<UpdateSqlPreviewResponse> => {
    const response: UpdateSqlPreviewResponse = await invoke("prepare_update_sql", {
        sql,
    });

    logBindingResponse("prepare_update_sql", response);

    return response;
};

export const executeUpdateSql = async (
    token: string
): Promise<UpdateSqlJobStartResponse> => {
    const response: UpdateSqlJobStartResponse = await invoke("execute_update_sql", {
        token,
    });

    logBindingResponse("execute_update_sql", response);

    return response;
};

export const getBackgroundJobStatus = async (
    jobId: string
): Promise<BackgroundJobStatusResponse> => {
    const response: BackgroundJobStatusResponse = await invoke("get_background_job_status", {
        jobId,
    });

    logBindingResponse("get_background_job_status", response);

    return response;
};

export const discardUpdateSql = async (token: string): Promise<boolean> => {
    const response: boolean = await invoke("discard_update_sql", { token });

    logBindingResponse("discard_update_sql", response);

    return response;
};

export const prepareDeleteSql = async (
    sql: string
): Promise<DeleteSqlPreviewResponse> => {
    const response: DeleteSqlPreviewResponse = await invoke("prepare_delete_sql", {
        sql,
    });

    logBindingResponse("prepare_delete_sql", response);

    return response;
};

export const executeDeleteSql = async (
    token: string
): Promise<DeleteSqlExecuteResponse> => {
    const response: DeleteSqlExecuteResponse = await invoke("execute_delete_sql", {
        token,
    });

    logBindingResponse("execute_delete_sql", response);

    return response;
};

export const discardDeleteSql = async (token: string): Promise<boolean> => {
    const response: boolean = await invoke("discard_delete_sql", { token });

    logBindingResponse("discard_delete_sql", response);

    return response;
};
