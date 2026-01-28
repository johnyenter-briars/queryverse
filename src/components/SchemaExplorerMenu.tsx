import { useState } from "react";
import {
    Button,
    Divider,
    Text,
    Title3,
} from "@fluentui/react-components";
import {
    ChevronDown24Regular,
    ChevronRight24Regular,
    Table24Filled,
} from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { EntityAttribute } from "../binding/model/EntityAttribute";
import { useSchemaExplorerMenuStyles } from "../styles/SchemaExplorerMenuStyles";

export interface ISchemaExplorerMenuProps {
    isOpen: boolean;
    entityDefinitions: EntityDefinition[];
    entityAttributes: Record<string, EntityAttribute[]>;
    attributesLoading: Record<string, boolean>;
    attributesError: Record<string, string | null>;
    onLoadAttributes: (logicalName: string) => void;
}

export function SchemaExplorerMenu({
    isOpen,
    entityDefinitions,
    entityAttributes,
    attributesLoading,
    attributesError,
    onLoadAttributes,
}: ISchemaExplorerMenuProps) {
    const styles = useConnectionsMenuStyles();
    const localStyles = useSchemaExplorerMenuStyles();
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
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

    const toggleTable = (logicalName: string) => {
        if (!logicalName) return;
        setExpandedTables((prev) => {
            const next = new Set(prev);
            if (next.has(logicalName)) {
                next.delete(logicalName);
            } else {
                next.add(logicalName);
                if (!entityAttributes[logicalName]) {
                    onLoadAttributes(logicalName);
                }
            }
            return next;
        });
    };

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
                        </div>
                    </div>
                    <Divider className={styles.sectionDivider} />
                    <div className={localStyles.body}>

                        <div className={localStyles.tableList}>
                            {entityDefinitions.map((table, index) => {
                                const displayName =
                                    getDisplayName(table.DisplayName) ??
                                    table.SchemaName ??
                                    table.LogicalName;
                                const tableKey =
                                    table.LogicalName ??
                                    table.SchemaName ??
                                    table.EntitySetName ??
                                    `table-${index}`;
                                const isExpanded = table.LogicalName
                                    ? expandedTables.has(table.LogicalName)
                                    : false;
                                const logicalName = table.LogicalName;
                                const attributes = logicalName
                                    ? entityAttributes[logicalName]
                                    : undefined;
                                const isLoading = logicalName
                                    ? attributesLoading[logicalName]
                                    : false;
                                const error = logicalName
                                    ? attributesError[logicalName]
                                    : null;
                                return (
                                    <div
                                        key={tableKey}
                                        className={localStyles.tableRow}
                                    >
                                        <div className={localStyles.tableHeader}>
                                            <Button
                                                className={localStyles.toggleButton}
                                                appearance="subtle"
                                                icon={
                                                    isExpanded
                                                        ? <ChevronDown24Regular />
                                                        : <ChevronRight24Regular />
                                                }
                                                onClick={() => toggleTable(logicalName)}
                                            />
                                            <Table24Filled />
                                            <div className={localStyles.tableText}>
                                                <Text>{displayName}</Text>
                                                <Text
                                                    size={200}
                                                    className={localStyles.tableMeta}
                                                >
                                                    {table.LogicalName} • {table.EntitySetName}
                                                </Text>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <div className={localStyles.attributeList}>
                                                {isLoading ? (
                                                    <Text size={200}>Loading attributes...</Text>
                                                ) : error ? (
                                                    <Text size={200} className={localStyles.errorText}>
                                                        {error}
                                                    </Text>
                                                ) : attributes?.length ? (
                                                    attributes.map((attribute) => (
                                                        <div
                                                            key={attribute.LogicalName}
                                                            className={localStyles.attributeRow}
                                                        >
                                                            <Text>{attribute.SchemaName}</Text>
                                                            <Text
                                                                size={200}
                                                                className={localStyles.attributeMeta}
                                                            >
                                                                {attribute.LogicalName}
                                                                {attribute.AttributeType
                                                                    ? ` • ${attribute.AttributeType}`
                                                                    : ""}
                                                            </Text>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <Text size={200}>No readable attributes.</Text>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
