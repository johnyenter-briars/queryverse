import { invoke } from "@tauri-apps/api/core";
import { CreateConnectionResponse } from "./model/CreateConnectionResponse";
import { CreateConnectionRequest } from "./model/CreateConnectionRequest";
import { UpdateConnectionRequest } from "./model/UpdateConnectionRequest";
import { UpdateConnectionResponse } from "./model/UpdateConnectionResponse";
import { FetchXmlPreview } from "./model/FetchXmlPreview";
import { ListConnectionsResponse } from "./model/ListConnectionsResponse";
import { ExecuteSqlRequest } from "./model/ExecuteSqlRequest";
import { EntityDefinition } from "./model/EntityDefinition";
import { SetConnectionRequest } from "./model/SetConnectionRequest";
import { ExecuteSqlResponse } from "./model/ExecuteSqlResponse";
import { MultipleResponse } from "./model/MultipleResponse";
import { OpenSqlFileResponse } from "./model/OpenSqlFileResponse";
import { SaveSqlFileRequest } from "./model/SaveSqlFileRequest";
import { SaveSqlFileAsRequest } from "./model/SaveSqlFileAsRequest";
import { SaveSqlFileAsResponse } from "./model/SaveSqlFileAsResponse";
import { LaunchContext } from "./model/LaunchContext";

export const executeSql = async (
    sql: string
): Promise<ExecuteSqlResponse> => {
    const response: ExecuteSqlResponse = await invoke("execute_sql", {
        request: {
            sql,
        } satisfies ExecuteSqlRequest,
    });

    console.log(response);

    return response;
};

export const previewFetchXml = async (sql: string): Promise<FetchXmlPreview> => {
    const response: FetchXmlPreview = await invoke("parse_sql_to_fetchxml", {
        sql,
    });

    console.log(response);

    return response;
};

export const createConnection = async (
    connectionRequest: CreateConnectionRequest
): Promise<CreateConnectionResponse> => {
    const response: CreateConnectionResponse = await invoke("create_connection", {
        connectionRequest: connectionRequest,
    });

    console.log(response);

    return response;
};

export const listConnections = async (): Promise<ListConnectionsResponse> => {
    const response: ListConnectionsResponse = await invoke("list_connections");

    console.log(response);

    return response;
};

export const updateConnection = async (
    connectionRequest: UpdateConnectionRequest
): Promise<UpdateConnectionResponse> => {
    const response: UpdateConnectionResponse = await invoke("update_connection", {
        connectionRequest: connectionRequest,
    });

    console.log(response);

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

    console.log(response);

    return response;
};

export const openSqlFile = async (): Promise<OpenSqlFileResponse | null> => {
    const response: OpenSqlFileResponse | null = await invoke("open_sql_file");

    console.log(response);

    return response;
};

export const openSqlFilePath = async (path: string): Promise<OpenSqlFileResponse> => {
    const response: OpenSqlFileResponse = await invoke("open_sql_file_path", {
        path,
    });

    console.log(response);

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

    console.log(response);

    return response;
};

export const getLaunchContext = async (): Promise<LaunchContext> => {
    const response: LaunchContext = await invoke("get_launch_context");

    console.log(response);

    return response;
};
