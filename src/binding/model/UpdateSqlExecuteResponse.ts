export type UpdateSqlExecuteResponse = {
    success: boolean;
    message: string;
    updated: number;
    failed: number;
    errors: string[];
};
