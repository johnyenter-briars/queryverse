import {
    Divider,
    Text,
    Title3,
} from "@fluentui/react-components";
import { Table24Filled } from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { useSchemaExplorerMenuStyles } from "../styles/SchemaExplorerMenuStyles";

export interface ISchemaExplorerMenuProps {
    isOpen: boolean;
    entityDefinitions: EntityDefinition[];
}

export function SchemaExplorerMenu({ isOpen, entityDefinitions }: ISchemaExplorerMenuProps) {
    const styles = useConnectionsMenuStyles();
    const localStyles = useSchemaExplorerMenuStyles();
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
                                return (
                                    <div
                                        key={tableKey}
                                        className={localStyles.tableRow}
                                    >
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
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
