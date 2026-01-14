import { invoke } from '@tauri-apps/api/core';
import { CreateConnectionResponse } from './model/CreateConnectionResponse';
import { CreateConnectionRequest } from './model/CreateConnectionRequest';
import { MultipleResponse } from './model/MultipleResponse';
import { Entity } from './model/Entity';

export const retrieveMultiple = async (): Promise<MultipleResponse<Entity>> => {
    const response: MultipleResponse<Entity> = await invoke('retrieve_multiple', {
        number: 42,
    })

    console.log(response)

    return response;
}

export const createConnection = async (connectionRequest: CreateConnectionRequest): Promise<CreateConnectionResponse> => {
    const response: CreateConnectionResponse = await invoke('create_connection', {
        connectionRequest: connectionRequest,
    });

    console.log(response);

    return response;
}
