import { invoke } from "@tauri-apps/api/core";
import { CreateConnectionResponse } from "./model/CreateConnectionResponse";
import { CreateConnectionRequest } from "./model/CreateConnectionRequest";
import { UpdateConnectionRequest } from "./model/UpdateConnectionRequest";
import { UpdateConnectionResponse } from "./model/UpdateConnectionResponse";
import { MultipleResponse } from "./model/MultipleResponse";
import { Entity } from "./model/Entity";
import { FetchXmlPreview } from "./model/FetchXmlPreview";
import { ListConnectionsResponse } from "./model/ListConnectionsResponse";
import { ExecuteSqlRequest } from "./model/ExecuteSqlRequest";
import { EntityDefinition } from "./model/EntityDefinition";
import { SetConnectionRequest } from "./model/SetConnectionRequest";

export const executeSql = async (
    sql: string
): Promise<MultipleResponse<Entity>> => {
    const response: MultipleResponse<Entity> = await invoke("execute_sql", {
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
