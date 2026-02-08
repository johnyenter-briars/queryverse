export type DeleteSqlExecuteResponse = {
    success: boolean;
    message: string;
    deleted: number;
    failed: number;
    errors: string[];
};
