import { invoke, InvokeArgs } from '@tauri-apps/api/core';
import { CreateConnectionResponse } from './model/CreateConnectionResponse';
import { CreateConnectionRequest } from './model/CreateConnectionRequest';

export const queryResults = async () => {
    const response = await invoke('query_results', {
        number: 42,
    })

    console.log(response)
}

export const createConnection = async (connectionRequest: CreateConnectionRequest): Promise<CreateConnectionResponse> => {
    const response: CreateConnectionResponse = await invoke('create_connection', {
        connectionRequest: connectionRequest,
    });

    console.log(response);

    return response;
}
