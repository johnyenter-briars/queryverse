import {
    Divider,
    Title3,
    Tree,
    TreeItem,
    TreeItemLayout,
} from "@fluentui/react-components";
import { FolderOpen24Filled, Table24Filled } from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";

export interface ISchemaExplorerMenuProps {
    isOpen: boolean;
}

export function SchemaExplorerMenu({ isOpen }: ISchemaExplorerMenuProps) {
    const styles = useConnectionsMenuStyles();
    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const mockSchema = [
        { name: "d365 dev", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 qa", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 prod", tables: ["systemuser", "account", "contact", "incident"] },
    ];

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
                    <Tree size="small" aria-label="Database Schema">
                        {mockSchema.map((db, dbIndex) => (
                            <TreeItem key={`db-${dbIndex}`} itemType="branch">
                                <TreeItemLayout><FolderOpen24Filled /> {db.name}</TreeItemLayout>
                                <Tree>
                                    {db.tables.map((table, tableIndex) => (
                                        <TreeItem key={`table-${dbIndex}-${tableIndex}`} itemType="leaf">
                                            <TreeItemLayout><Table24Filled /> {table}</TreeItemLayout>
                                        </TreeItem>
                                    ))}
                                </Tree>
                            </TreeItem>
                        ))}
                    </Tree>
                </div>
            </div>
        </div>
    );
}
