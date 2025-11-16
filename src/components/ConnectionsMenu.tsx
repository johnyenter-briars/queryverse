import {
    webDarkTheme,
    makeStyles,
    shorthands,
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
import { Connection, ConnectionMethod } from "../binding/model/Connection";
import { RequestType } from "../binding/model/QVRequest";
import { useState } from "react";

const DRAWER_WIDTH = "300px";

const useStyles = makeStyles({
    // BASE Flyout Style (ALWAYS applied - handles hidden state/transition)
    flyoutBase: {
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        // Initial state: hidden off-screen to the left
        transform: `translateX(-${DRAWER_WIDTH})`,
        transition: `transform ${tokens.durationNormal} ${tokens.curveEasyEase}`,
        ...shorthands.borderRight(`1px solid ${tokens.colorNeutralStroke1}`),
    },
    // OPEN Class (Applied conditionally to override transform to visible state)
    flyoutOpen: {
        transform: "translateX(0)",
    },
    flyoutHalf: {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        ...shorthands.padding(tokens.spacingHorizontalM),
    },
});

export interface IConnectionsMenuProps {
    isOpen: boolean
};

export function ConnectionsMenu({ isOpen }: IConnectionsMenuProps) {
    const styles = useStyles();

    const flyoutClasses = combineClasses(
        styles.flyoutBase,
        isOpen && styles.flyoutOpen
    );

    const mockSchema = [
        { name: "d365 dev", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 qa", tables: ["systemuser", "account", "contact", "incident"] },
        { name: "d365 prod", tables: ["systemuser", "account", "contact", "incident"] },
    ];
    const mockConnections = [
    ];

    const [connections, setConnections] = useState<Connection[]>([
        { name: "d365 dev", id: null, method: ConnectionMethod.ClientSecret },
        { name: "d365 qa", id: null, method: ConnectionMethod.ClientSecret },
        { name: "d365 prod", id: null, method: ConnectionMethod.ClientSecret },
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
                                method: ConnectionMethod.ClientSecret,
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