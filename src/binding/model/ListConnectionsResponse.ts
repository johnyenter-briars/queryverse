import { Connection } from "./Connection";
import { QVResponse } from "./QVResponse";

export interface ListConnectionsResponse extends QVResponse<Connection[]> {
}
