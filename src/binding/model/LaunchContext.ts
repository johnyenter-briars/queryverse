export interface LaunchContext {
    sqlFilePath?: string | null;
    connectionName?: string | null;
    logLevel?: "debug" | "information";
}
