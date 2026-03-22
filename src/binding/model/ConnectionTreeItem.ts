import { Connection } from "./Connection";
import { ConnectionFolder } from "./ConnectionFolder";

export interface ConnectionFolderTreeItem extends ConnectionFolder {
    kind: "folder";
    children: ConnectionTreeItem[];
}

export interface ConnectionLeafTreeItem extends Connection {
    kind: "connection";
}

export type ConnectionTreeItem = ConnectionFolderTreeItem | ConnectionLeafTreeItem;
