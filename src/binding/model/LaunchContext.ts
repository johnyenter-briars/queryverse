export interface LaunchContext {
    sqlFilePath?: string | null;
    connectionName?: string | null;
    logLevel?: "error" | "warn" | "information" | "debug" | "trace";
}
