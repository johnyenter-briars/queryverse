export interface SqlQueryMetadata {
    columnsSelected: boolean;
    columnsOrder: string[];
    entityLogicalName?: string | null;
}
