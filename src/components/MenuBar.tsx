import * as React from "react";
import {
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    Button,
    makeStyles,
    shorthands,
    tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
    container: {
        position: "relative", // ⬅ important
        zIndex: 10,
        height: "28px",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        paddingLeft: "0.75rem",
        backgroundColor: tokens.colorNeutralBackground3,
        color: tokens.colorNeutralForeground1,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    itemButton: {
        background: "none",
        color: tokens.colorNeutralForeground1,
        ...shorthands.padding(0),
        minHeight: 0,
        height: "28px",
        fontSize: "13px",
        ":hover": {
            backgroundColor: tokens.colorNeutralBackground4,
        },
    },
    popover: {
        position: "absolute",
        top: "28px !important",
        left: "0px",
        width: "auto",
        height: "auto",
        zIndex: 99999,
    },
});

export function MenuBar() {
    const styles = useStyles();

    return (
        <div className={styles.container}>
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Button className={styles.itemButton} appearance="subtle">
                        File
                    </Button>
                </MenuTrigger>
                <MenuPopover className={styles.popover}>
                    <MenuList>
                        <MenuItem>New File</MenuItem>
                        <MenuItem>Open...</MenuItem>
                        <MenuItem>Save</MenuItem>
                        <MenuItem>Save As...</MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>

            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Button className={styles.itemButton} appearance="subtle">
                        Connections
                    </Button>
                </MenuTrigger>
                <MenuPopover className={styles.popover}>
                    <MenuList>
                        <MenuItem>New Connection</MenuItem>
                        <MenuItem>Manage Connections</MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>

            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Button className={styles.itemButton} appearance="subtle">
                        Settings
                    </Button>
                </MenuTrigger>
                <MenuPopover className={styles.popover}>
                    <MenuList>
                        <MenuItem>Preferences</MenuItem>
                        <MenuItem>Theme: Dark</MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>
        </div>
    );
}

