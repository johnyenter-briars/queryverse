export type EntityAttribute = {
    LogicalName: string;
    SchemaName: string;
    AttributeType?: string;
    IsCustomAttribute?: boolean;
    IsValidODataAttribute?: boolean;
    IsValidForRead?: boolean;
    IsValidForUpdate?: boolean;
};
