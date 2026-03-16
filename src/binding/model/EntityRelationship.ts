export type EntityRelationship = {
    SchemaName: string;
    RelationshipType: string;
    ReferencedEntity?: string;
    ReferencedAttribute?: string;
    ReferencingEntity?: string;
    ReferencingAttribute?: string;
    IntersectEntityName?: string;
    IsCustomRelationship?: boolean;
};
