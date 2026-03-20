import { DeleteSqlExecuteResponse } from "./DeleteSqlExecuteResponse";
import { UpdateSqlExecuteResponse } from "./UpdateSqlExecuteResponse";

export type BackgroundJobState = "running" | "failed" | "success";

export type BackgroundJobResult =
    | {
          update: UpdateSqlExecuteResponse;
      }
    | {
          delete: DeleteSqlExecuteResponse;
      };

export type BackgroundJobStatus = {
    jobId: string;
    kind: string;
    state: BackgroundJobState;
    currentBatch: number;
    totalBatches: number;
    processed: number;
    total: number;
    message: string;
    result?: BackgroundJobResult | null;
};
