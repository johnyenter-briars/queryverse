export type EntityDefinition = {
    logicalName: string;
    schemaName: string;
    displayName?: unknown;
    entitySetName: string;
    isCustomEntity: boolean;
    primaryIdAttribute?: string;
};
