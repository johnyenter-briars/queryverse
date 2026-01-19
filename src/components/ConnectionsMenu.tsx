import {
    tokens,
    Title3,
    Tree,
    TreeItem,
    TreeItemLayout,
    Divider,
    Button,
} from "@fluentui/react-components";
import {
    Table24Filled,
    FolderOpen24Filled,
    AddCircleRegular,
} from "@fluentui/react-icons";
import { combineClasses } from "../utility/class";
import { createConnection } from "../binding/backend";
import { Connection } from "../binding/model/Connection";
import { RequestType } from "../binding/model/QVRequest";
import { useState } from "react";
import { useConnectionsMenuStyles } from "../styles/ConnectionsMenuStyles";

export interface IConnectionsMenuProps {
    isOpen: boolean
};

export function ConnectionsMenu({ isOpen }: IConnectionsMenuProps) {
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

    const [connections, setConnections] = useState<Connection[]>([
        {
            name: "d365 dev",
            id: null,
            method: "ClientSecret",
            clientId: "foo",
            clientSecret: "bing",
            tenantId: "baz",
        },
    ]);

    return (
        <div
            className={flyoutClasses}
            style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        >
            <div className={`${styles.flyoutHalf}`}>
                <Title3 className="mb-2">Connections</Title3>
                <Button
                    size="large"
                    icon={<AddCircleRegular />}
                    onClick={async () => {
                        const newConnection = await createConnection({
                            requestType: RequestType.Create,
                            value: {
                                name: "conn1",
                                id: null,
                                method: "ClientSecret",
                                clientId: "foo",
                                clientSecret: "bing",
                                tenantId: "baz",
                            }
                        });

                        const foo = [...connections];
                        foo.push(newConnection.value);

                        setConnections(foo);
                    }}
                />
                <Divider />
                <Tree size="small" aria-label="Connections List">
                    {connections.map((conn, index) => (
                        <TreeItem key={`conn-${index}`} itemType="leaf">
                            <TreeItemLayout>
                                <FolderOpen24Filled
                                    style={{ color: tokens.colorPaletteGreenForeground1 }}
                                />
                                {conn.name}
                            </TreeItemLayout>
                        </TreeItem>
                    ))}
                </Tree>
            </div>

            <div className={`${styles.flyoutHalf}`}>
                <Title3 className="mb-2">Schema Explorer</Title3>
                <Divider />
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
    );
}
