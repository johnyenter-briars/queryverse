import { invoke } from "@tauri-apps/api/core";
import { CreateConnectionResponse } from "./model/CreateConnectionResponse";
import { CreateConnectionRequest } from "./model/CreateConnectionRequest";
import { MultipleResponse } from "./model/MultipleResponse";
import { Entity } from "./model/Entity";
import { FetchXmlPreview } from "./model/FetchXmlPreview";

export const executeSql = async (sql: string): Promise<MultipleResponse<Entity>> => {
    const response: MultipleResponse<Entity> = await invoke("execute_sql", {
        sql,
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
