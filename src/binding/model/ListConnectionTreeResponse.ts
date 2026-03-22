import { ConnectionTreeItem } from "./ConnectionTreeItem";
import { QVResponse } from "./QVResponse";

export interface ListConnectionTreeResponse extends QVResponse<ConnectionTreeItem[]> {
}
