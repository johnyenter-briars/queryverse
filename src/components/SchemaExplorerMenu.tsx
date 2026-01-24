import {
    Button,
    Divider,
    Spinner,
    Text,
    Title3,
} from "@fluentui/react-components";
import { Table24Filled } from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { Connection } from "../binding/model/Connection";
import { EntityDefinition } from "../binding/model/EntityDefinition";
import { listEntityDefinitions } from "../binding/function";
import { useState } from "react";
import { useSchemaExplorerMenuStyles } from "../styles/SchemaExplorerMenuStyles";

export interface ISchemaExplorerMenuProps {
    isOpen: boolean;
    currentConnection: Connection | null;
}

export function SchemaExplorerMenu({ isOpen, currentConnection }: ISchemaExplorerMenuProps) {
    const styles = useConnectionsMenuStyles();
    const localStyles = useSchemaExplorerMenuStyles();
    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const [tables, setTables] = useState<EntityDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    const handleRetrieveMetadata = async () => {
        if (!currentConnection?.id) {
            setErrorMessage("Not connected.");
            return;
        }

        setErrorMessage(null);
        setIsLoading(true);
        try {
            const response = await listEntityDefinitions(currentConnection.id);
            if (!response.success) {
                setErrorMessage(response.message || "Failed to retrieve metadata.");
                setTables([]);
                return;
            }
            setTables(response.value ?? []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to retrieve metadata.");
            setTables([]);
        } finally {
            setIsLoading(false);
        }
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
                        {errorMessage ? (
                            <Text className={localStyles.errorText}>{errorMessage}</Text>
                        ) : null}
                        {isLoading ? (
                            <Spinner label="Retrieving metadata..." />
                        ) : tables.length === 0 ? (
                            <Button appearance="primary" onClick={handleRetrieveMetadata}>
                                Retrieve metadata
                            </Button>
                        ) : (
                            <div className={localStyles.tableList}>
                                {tables.map((table, index) => {
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
