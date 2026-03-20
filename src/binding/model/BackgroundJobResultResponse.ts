import { QVResponse } from "./QVResponse";
import { UpdateSqlExecuteResponse } from "./UpdateSqlExecuteResponse";

export interface BackgroundJobResultResponse extends QVResponse<UpdateSqlExecuteResponse> {}
