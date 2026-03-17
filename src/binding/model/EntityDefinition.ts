export type EntityDefinition = {
    LogicalName: string;
    SchemaName: string;
    DisplayName?: unknown;
    EntitySetName: string;
    IsCustomEntity: boolean;
    IsActivity?: boolean;
    PrimaryIdAttribute?: string;
};
