import * as React from "react";
import { useState, useMemo } from "react";
import {
    FluentProvider,
    webDarkTheme,
    makeStyles,
    shorthands,
    tokens,
    Button,
    Title3,
    Tree,
    TreeItem,
    TreeItemLayout,
    Toolbar,
    ToolbarButton,
    Divider,
} from "@fluentui/react-components";
import {
    Navigation24Regular, // Icon for opening the flyout
    CubeTree24Filled, // Icon for Schema
    Table24Filled, // Icon for Tables
    FolderOpen24Filled, // Icon for Database/Connection
    Settings24Filled,
    Play24Filled,
} from "@fluentui/react-icons";



// type ConnectionsMenuProps = {
//     isOpen: boolean;
// };

// /**
//  * A left-side flyout containing two sections: Connections and Schema.
//  */
// function ConnectionsMenu({ isOpen }: ConnectionsMenuProps) {
//     const styles = useStyles({ isMenuOpen: isOpen });

//     // Mock data for the two tree views
//     const mockSchema = [
//         { name: "production_db", tables: ["users", "orders", "products", "transactions"] },
//         { name: "analytics_wh", tables: ["events", "sessions", "clicks"] },
//         { name: "staging_db", tables: ["temp_data"] },
//     ];
//     const mockConnections = [
//         { name: "Primary Localhost (SQL)", status: "Active" },
//         { name: "Dev Server (SSH Tunnel)", status: "Inactive" },
//         { name: "QA Read Replica", status: "Active" },
//     ];

//     return (
//         <div className={styles.flyout} style={{ pointerEvents: isOpen ? 'auto' : 'none' }}>
//             {/* Top Half: Connections Tree */}
//             <div className={`${styles.flyoutHalf} ${styles.customScroll}`}>
//                 <Title3 className="mb-2">Connections</Title3>
//                 <Divider />
//                 <Tree size="small" aria-label="Connections List">
//                     {mockConnections.map((conn, index) => (
//                         <TreeItem key={`conn-${index}`} itemType="leaf">
//                             <TreeItemLayout>
//                                 <FolderOpen24Filled
//                                     style={{ color: conn.status === 'Active' ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForegroundDisabled }}
//                                 />
//                                 {conn.name}
//                             </TreeItemLayout>
//                         </TreeItem>
//                     ))}
//                 </Tree>
//             </div>

//             {/* Middle Divider */}
//             <Divider />

//             {/* Bottom Half: Schema Tree */}
//             <div className={`${styles.flyoutHalf} ${styles.customScroll}`}>
//                 <Title3 className="mb-2">Schema Explorer</Title3>
//                 <Divider />
//                 <Tree size="small" aria-label="Database Schema">
//                     {mockSchema.map((db, dbIndex) => (
//                         <TreeItem key={`db-${dbIndex}`} itemType="branch">
//                             <TreeItemLayout><FolderOpen24Filled /> {db.name}</TreeItemLayout>
//                             <Tree>
//                                 {db.tables.map((table, tableIndex) => (
//                                     <TreeItem key={`table-${dbIndex}-${tableIndex}`} itemType="leaf">
//                                         <TreeItemLayout><Table24Filled /> {table}</TreeItemLayout>
//                                     </TreeItem>
//                                 ))}
//                             </Tree>
//                         </TreeItem>
//                     ))}
//                 </Tree>
//             </div>
//         </div>
//     );
// }
