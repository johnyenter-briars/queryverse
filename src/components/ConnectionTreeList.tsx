import { ReactNode, useEffect, useState } from "react";
import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import {
    ChevronDown12Regular,
    ChevronRight12Regular,
    Folder24Regular,
    Link24Filled,
} from "@fluentui/react-icons";

import { Connection } from "../binding/model/Connection";
import { ConnectionFolderTreeItem, ConnectionTreeItem } from "../binding/model/ConnectionTreeItem";

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
        minWidth: 0,
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        minWidth: 0,
        width: "100%",
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        transitionProperty: "background-color, color",
        transitionDuration: tokens.durationFast,
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    rowButton: {
        backgroundColor: "transparent",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        width: "100%",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        ...shorthands.padding(0),
    },
    expander: {
        width: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    label: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    folderLabel: {
        fontWeight: tokens.fontWeightMedium,
    },
    actionSlot: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        flexShrink: 0,
    },
});

const collectFolderIds = (items: ConnectionTreeItem[]): string[] =>
    items.flatMap((item) =>
        item.kind === "folder"
            ? [item.id, ...collectFolderIds(item.children)]
            : []
    );

export interface ConnectionTreeListProps {
    items: ConnectionTreeItem[];
    onConnectionSelect: (connection: Connection) => void;
    onConnectionContextMenu?: (connection: Connection, x: number, y: number) => void;
    onFolderContextMenu?: (folder: ConnectionFolderTreeItem, x: number, y: number) => void;
    renderConnectionActions?: (connection: Connection) => ReactNode;
}

export function ConnectionTreeList({
    items,
    onConnectionSelect,
    onConnectionContextMenu,
    onFolderContextMenu,
    renderConnectionActions,
}: ConnectionTreeListProps) {
    const styles = useStyles();
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const nextFolderIds = collectFolderIds(items);
        setExpandedFolders((prev) => {
            const next = { ...prev };
            for (const folderId of nextFolderIds) {
                if (typeof next[folderId] === "undefined") {
                    next[folderId] = true;
                }
            }
            return next;
        });
    }, [items]);

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((prev) => ({
            ...prev,
            [folderId]: !prev[folderId],
        }));
    };

    const renderItems = (treeItems: ConnectionTreeItem[], depth: number, inheritedColor?: string | null): ReactNode =>
        treeItems.map((item) => {
            if (item.kind === "folder") {
                const color = item.color ?? inheritedColor ?? undefined;
                const isExpanded = expandedFolders[item.id] !== false;

                return (
                    <div key={`folder-${item.id}`}>
                        <div
                            className={styles.row}
                            style={{ paddingLeft: `${12 + depth * 18}px`, color }}
                            onContextMenu={(event) => {
                                if (!onFolderContextMenu) return;
                                event.preventDefault();
                                onFolderContextMenu(item, event.clientX, event.clientY);
                            }}
                        >
                            <button
                                type="button"
                                className={styles.rowButton}
                                onClick={() => toggleFolder(item.id)}
                            >
                                <span className={styles.expander}>
                                    {isExpanded ? <ChevronDown12Regular /> : <ChevronRight12Regular />}
                                </span>
                                <Folder24Regular />
                                <span className={`${styles.label} ${styles.folderLabel}`}>
                                    {item.name}
                                </span>
                            </button>
                        </div>
                        {isExpanded ? renderItems(item.children, depth + 1, color) : null}
                    </div>
                );
            }

            return (
                <div
                    key={`connection-${item.id ?? item.name}`}
                    className={styles.row}
                    style={{ paddingLeft: `${12 + depth * 18}px`, color: inheritedColor ?? undefined }}
                    onContextMenu={(event) => {
                        if (!onConnectionContextMenu) return;
                        event.preventDefault();
                        onConnectionContextMenu(item, event.clientX, event.clientY);
                    }}
                >
                    <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() => onConnectionSelect(item)}
                    >
                        <span className={styles.expander} />
                        <Link24Filled />
                        <span className={styles.label}>{item.name}</span>
                    </button>
                    {renderConnectionActions ? (
                        <div className={styles.actionSlot}>{renderConnectionActions(item)}</div>
                    ) : null}
                </div>
            );
        });

    return <div className={styles.root}>{renderItems(items, 0, null)}</div>;
}
