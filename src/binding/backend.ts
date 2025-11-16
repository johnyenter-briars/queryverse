import { invoke, InvokeArgs } from '@tauri-apps/api/core';
import { Connection } from './model/Connection';
import { CreateConnectionResponse } from './model/CreateConnectionResponse';
import { CreateConnectionRequest } from './model/CreateConnectionRequest';

export const queryResults = async () => {
    const bing = await invoke('query_results', {
        number: 42,
    })

    debugger;
}

export const createConnection = async (connectionRequest: CreateConnectionRequest): Promise<CreateConnectionResponse> => {
    const response: CreateConnectionResponse = await invoke('create_connection', {
        connectionRequest: connectionRequest,
    });

    console.log(response);

    return response;
}
