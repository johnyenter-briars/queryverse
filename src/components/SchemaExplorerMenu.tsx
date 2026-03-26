import {
    Button,
    Divider,
    Field,
    Input,
    Text,
    Title3,
} from "@fluentui/react-components";
import { useMemo, useState } from "react";
import { Table24Filled } from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { Connection } from "../binding/model/Connection";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { useSchemaExplorerMenuStyles } from "../styles/SchemaExplorerMenuStyles";

export interface ISchemaExplorerMenuProps {
    isOpen: boolean;
    connections: Connection[];
    selectedConnectionId: string | null;
    onSelectedConnectionChange: (connectionId: string | null) => void;
    entityDefinitions: EntityDefinition[];
    onOpenEntity: (entity: EntityDefinition) => void;
}

export function SchemaExplorerMenu({
    isOpen,
    connections,
    selectedConnectionId,
    onSelectedConnectionChange,
    entityDefinitions,
    onOpenEntity,
}: ISchemaExplorerMenuProps) {
    const styles = useConnectionsMenuStyles();
    const localStyles = useSchemaExplorerMenuStyles();
    const [filterText, setFilterText] = useState("");
    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const getDisplayName = (displayName: EntityDefinition["DisplayName"]) => {
        if (!displayName || typeof displayName !== "object") {
            return null;
        }
        const label =
            (displayName as { UserLocalizedLabel?: { Label?: string } })
                ?.UserLocalizedLabel?.Label ??
            (displayName as { LocalizedLabels?: Array<{ Label?: string }> })
                ?.LocalizedLabels?.[0]?.Label;
        return label ?? null;
    };

    const filteredEntities = useMemo(() => {
        const normalizedFilter = filterText.trim().toLowerCase();
        if (!normalizedFilter) return entityDefinitions;

        return entityDefinitions.filter((entity) => {
            const displayName =
                getDisplayName(entity.DisplayName) ??
                entity.SchemaName ??
                entity.LogicalName;

            return [
                displayName,
                entity.LogicalName,
                entity.SchemaName,
                entity.EntitySetName,
            ]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(normalizedFilter));
        });
    }, [entityDefinitions, filterText]);

    return (
        <div
            className={flyoutClasses}
            style={{ pointerEvents: isOpen ? "auto" : "none" }}
        >
            <div className={styles.flyoutHalf}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <Title3>Schema Explorer</Title3>
                            <Text size={200} className={styles.sectionSubtitle}>
                                Select an entity to open its schema in a tab.
                            </Text>
                        </div>
                    </div>
                    <Divider className={styles.sectionDivider} />
                    <div className={localStyles.body}>
                        <Field label="Connection">
                            <select
                                className={localStyles.connectionSelect}
                                value={selectedConnectionId ?? ""}
                                onChange={(event) =>
                                    onSelectedConnectionChange(event.target.value || null)
                                }
                            >
                                <option value="">Select connection</option>
                                {connections.map((connection) => (
                                    <option
                                        key={connection.id ?? connection.name}
                                        value={connection.id ?? ""}
                                    >
                                        {connection.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Input
                            value={filterText}
                            onChange={(_, data) => setFilterText(data.value)}
                            placeholder="Filter entities"
                            className={localStyles.filterInput}
                        />
                        <div className={localStyles.tableList}>
                            {filteredEntities.map((table, index) => {
                                const displayName =
                                    getDisplayName(table.DisplayName) ??
                                    table.SchemaName ??
                                    table.LogicalName;
                                const tableKey =
                                    table.LogicalName ??
                                    table.SchemaName ??
                                    table.EntitySetName ??
                                    `table-${index}`;

                                return (
                                    <Button
                                        key={tableKey}
                                        appearance="subtle"
                                        className={localStyles.entityButton}
                                        icon={<Table24Filled />}
                                        onClick={() => onOpenEntity(table)}
                                    >
                                        <div className={localStyles.tableText}>
                                            <Text>{displayName}</Text>
                                            <Text
                                                size={200}
                                                className={localStyles.tableMeta}
                                            >
                                                {table.LogicalName} • {table.EntitySetName}
                                            </Text>
                                        </div>
                                    </Button>
                                );
                            })}
                            {!filteredEntities.length ? (
                                <Text size={200} className={localStyles.emptyState}>
                                    No entities match the current filter.
                                </Text>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
