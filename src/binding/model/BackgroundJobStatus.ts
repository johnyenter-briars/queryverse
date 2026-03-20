import { UpdateSqlExecuteResponse } from "./UpdateSqlExecuteResponse";

export type BackgroundJobState = "running" | "failed" | "success";

export type BackgroundJobResult =
    | {
          update: UpdateSqlExecuteResponse;
      };

export type BackgroundJobStatus = {
    jobId: string;
    kind: string;
    state: BackgroundJobState;
    processed: number;
    total: number;
    message: string;
    result?: BackgroundJobResult | null;
};
