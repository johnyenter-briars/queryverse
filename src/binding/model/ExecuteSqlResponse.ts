import { Entity } from "./Entity";
import { QVResponse } from "./QVResponse";
import { SqlQueryMetadata } from "./SqlQueryMetadata";

export interface ExecuteSqlResponse extends QVResponse<Entity[]> {
    metadata: SqlQueryMetadata;
}
