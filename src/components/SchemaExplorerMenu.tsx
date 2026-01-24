import {
    Button,
    Divider,
    Spinner,
    Text,
    Title3,
    makeStyles,
    shorthands,
    tokens,
} from "@fluentui/react-components";
import { Table24Filled } from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";
import { Connection } from "../binding/model/Connection";
import { EntityDefinitionSummary } from "../binding/model/EntityDefinitionSummary";
import { listEntityDefinitions } from "../binding/function";
import { useState } from "react";

export interface ISchemaExplorerMenuProps {
    isOpen: boolean;
    currentConnection: Connection | null;
}

const useSchemaExplorerStyles = makeStyles({
    body: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    tableList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    tableRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        padding: tokens.spacingVerticalXS,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke2}`),
    },
    tableText: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    tableMeta: {
        color: tokens.colorNeutralForeground2,
    },
    errorText: {
        color: tokens.colorPaletteRedForeground1,
    },
});

export function SchemaExplorerMenu({ isOpen, currentConnection }: ISchemaExplorerMenuProps) {
    const styles = useConnectionsMenuStyles();
    const localStyles = useSchemaExplorerStyles();
    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const [tables, setTables] = useState<EntityDefinitionSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const getDisplayName = (displayName: EntityDefinitionSummary["displayName"]) => {
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
                                {tables.map((table) => {
                                    const displayName =
                                        getDisplayName(table.displayName) ??
                                        table.schemaName ??
                                        table.logicalName;
                                    return (
                                        <div
                                            key={table.logicalName}
                                            className={localStyles.tableRow}
                                        >
                                            <Table24Filled />
                                            <div className={localStyles.tableText}>
                                                <Text>{displayName}</Text>
                                                <Text
                                                    size={200}
                                                    className={localStyles.tableMeta}
                                                >
                                                    {table.logicalName} • {table.entitySetName}
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
