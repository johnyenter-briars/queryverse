import { CreateConnectionPayload } from "./CreateConnectionPayload";

export interface UpdateConnectionRequest {
    id: string | null;
    index: number;
    payload: CreateConnectionPayload;
}
