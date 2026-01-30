import { ResultRow } from "./ResultRow";
import { QVResponse } from "./QVResponse";
import { SqlQueryMetadata } from "./SqlQueryMetadata";

export interface ExecuteSqlResponse extends QVResponse<ResultRow[]> {
    metadata: SqlQueryMetadata;
}
