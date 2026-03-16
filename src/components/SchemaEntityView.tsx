import { Input, Text, Title3 } from "@fluentui/react-components";
import { useState } from "react";
import { EntityAttribute } from "../binding/model/EntityAttribute";
import { EntityRelationship } from "../binding/model/EntityRelationship";
import { useSchemaEntityViewStyles } from "../styles/SchemaEntityViewStyles";

interface SchemaEntityViewProps {
    title: string;
    logicalName: string;
    attributes?: EntityAttribute[];
    relationships?: EntityRelationship[];
    isLoading: boolean;
    error?: string | null;
}

export function SchemaEntityView({
    title,
    logicalName,
    attributes,
    relationships,
    isLoading,
    error,
}: SchemaEntityViewProps) {
    const styles = useSchemaEntityViewStyles();
    const [filterText, setFilterText] = useState("");
    const normalizedFilter = filterText.trim().toLowerCase();
    const filteredAttributes = attributes?.filter((attribute) => {
        if (!normalizedFilter) return true;
        return [
            attribute.SchemaName,
            attribute.LogicalName,
            attribute.AttributeType,
        ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedFilter));
    });
    const filteredRelationships = relationships?.filter((relationship) => {
        if (!normalizedFilter) return true;
        return [
            relationship.SchemaName,
            relationship.RelationshipType,
            relationship.ReferencedEntity,
            relationship.ReferencedAttribute,
            relationship.ReferencingEntity,
            relationship.ReferencingAttribute,
            relationship.IntersectEntityName,
        ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedFilter));
    });

    return (
        <div className={styles.root}>
            <div className={styles.header}>
                <Title3>{title}</Title3>
                <Text size={200} className={styles.subtle}>
                    {logicalName}
                </Text>
            </div>

            <div className={styles.filterBar}>
                <Input
                    value={filterText}
                    onChange={(_, data) => setFilterText(data.value)}
                    placeholder="Filter columns and relationships"
                    className={styles.filterInput}
                />
            </div>

            {isLoading ? (
                <div className={styles.status}>
                    <Text>Loading schema metadata...</Text>
                </div>
            ) : error ? (
                <div className={styles.status}>
                    <Text className={styles.error}>{error}</Text>
                </div>
            ) : (
                <div className={styles.sections}>
                    <section className={styles.section}>
                        <Text weight="semibold" className={styles.sectionTitle}>
                            Columns
                        </Text>
                        <div className={styles.rows}>
                            {filteredAttributes?.length ? (
                                filteredAttributes.map((attribute) => (
                                    <div
                                        key={attribute.LogicalName}
                                        className={styles.row}
                                    >
                                        <Text>{attribute.SchemaName}</Text>
                                        <Text size={200} className={styles.subtle}>
                                            {attribute.LogicalName}
                                            {attribute.AttributeType
                                                ? ` • ${attribute.AttributeType}`
                                                : ""}
                                        </Text>
                                    </div>
                                ))
                            ) : normalizedFilter && attributes?.length ? (
                                <Text size={200} className={styles.subtle}>
                                    No columns match the current filter.
                                </Text>
                            ) : (
                                <Text size={200} className={styles.subtle}>
                                    No readable columns.
                                </Text>
                            )}
                        </div>
                    </section>

                    <section className={styles.section}>
                        <Text weight="semibold" className={styles.sectionTitle}>
                            Relationships
                        </Text>
                        <div className={styles.rows}>
                            {filteredRelationships?.length ? (
                                filteredRelationships.map((relationship) => (
                                    <div
                                        key={`${relationship.RelationshipType}-${relationship.SchemaName}`}
                                        className={styles.row}
                                    >
                                        <Text>{relationship.SchemaName}</Text>
                                        <Text size={200} className={styles.subtle}>
                                            {relationship.RelationshipType}
                                            {relationship.ReferencedEntity
                                                ? ` • ${relationship.ReferencedEntity}`
                                                : ""}
                                            {relationship.ReferencingEntity
                                                ? ` → ${relationship.ReferencingEntity}`
                                                : ""}
                                            {relationship.IntersectEntityName
                                                ? ` • ${relationship.IntersectEntityName}`
                                                : ""}
                                        </Text>
                                    </div>
                                ))
                            ) : normalizedFilter && relationships?.length ? (
                                <Text size={200} className={styles.subtle}>
                                    No relationships match the current filter.
                                </Text>
                            ) : (
                                <Text size={200} className={styles.subtle}>
                                    No relationships.
                                </Text>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
