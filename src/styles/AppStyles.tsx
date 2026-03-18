import { shorthands, tokens, webDarkTheme, makeStyles } from "@fluentui/react-components";

const DRAWER_WIDTH = "420px";


export const useAppStyles = makeStyles({
    // Global App Layout
    root: {
        ...shorthands.padding(0),
        ...shorthands.margin(0),
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: webDarkTheme.colorNeutralBackground1,
        color: webDarkTheme.colorNeutralForeground1,
        overflow: "hidden",
    },
    // Main Wrapper for the Flyout and Content Area
    wrapper: {
        flex: 1,
        display: "flex",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
    },

    // BASE Content Area Style (ALWAYS applied)
    contentArea: {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flexGrow: 1,
        transitionDuration: tokens.durationNormal,
        transitionProperty: "margin-left, width",
        width: "100%",
        marginLeft: "0",
    },
    // SHIFTED Class (Applied conditionally for dynamic effect)
    contentShifted: {
        marginLeft: DRAWER_WIDTH,
        width: `calc(100% - ${DRAWER_WIDTH})`,
    },

    // Placeholder Sections
    top: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        overflow: "hidden",
    },
    tabsBar: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        paddingBottom: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalXS,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    tabLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    tabClose: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        borderRadius: tokens.borderRadiusCircular,
        color: tokens.colorNeutralForeground2,
        cursor: "pointer",
        userSelect: "none",
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
            color: tokens.colorNeutralForeground1,
        },
        "&:active": {
            backgroundColor: tokens.colorNeutralBackground1Pressed,
        },
    },
    tabCloseDirty: {
        color: "transparent",
        position: "relative",
        "&::before": {
            content: '""',
            position: "absolute",
            width: "8px",
            height: "8px",
            borderRadius: tokens.borderRadiusCircular,
            backgroundColor: tokens.colorPaletteRedForeground1,
            boxShadow: `0 0 0 2px ${webDarkTheme.colorNeutralBackground1}`,
        },
        "&:hover": {
            color: tokens.colorNeutralForeground1,
        },
        "&:hover::before": {
            opacity: 0,
        },
    },
    tabsList: {
        flex: 1,
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
    },
    addTabButton: {
        flexShrink: 0,
    },
    bottom: {
        flex: 1,
        overflowY: "auto",
        paddingTop: tokens.spacingVerticalS,
    },
    connectionPicker: {
        display: "grid",
        gap: tokens.spacingVerticalXS,
    },
    connectionPickerModal: {
        width: "280px",
        maxWidth: "100%",
    },
    deviceCodeModal: {
        width: "420px",
        maxWidth: "100%",
        display: "grid",
        gap: tokens.spacingVerticalM,
    },
    deviceCodeBlock: {
        backgroundColor: webDarkTheme.colorNeutralBackground3,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: tokens.borderRadiusMedium,
        position: "relative",
        paddingTop: tokens.spacingVerticalS,
        paddingRight: "44px",
        paddingBottom: tokens.spacingVerticalS,
        paddingLeft: tokens.spacingHorizontalM,
        fontFamily: "Consolas, monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
    deviceCodeRow: {
        display: "grid",
        gap: tokens.spacingVerticalXXS,
    },
    deviceCodeCopyButton: {
        position: "absolute",
        top: "50%",
        right: tokens.spacingHorizontalXS,
        transform: "translateY(-50%)",
    },
    connectionPickerItem: {
        justifyContent: "flex-start",
        gap: tokens.spacingHorizontalS,
    },
    connectionPickerIcon: {
        color: tokens.colorPaletteGreenForeground1,
    },
    tabContextMenu: {
        position: "fixed",
        minWidth: "180px",
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        boxShadow: tokens.shadow16,
        borderRadius: tokens.borderRadiusMedium,
        padding: tokens.spacingVerticalXS,
        zIndex: 1000,
    },
    tabContextMenuItem: {
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        color: webDarkTheme.colorNeutralForeground1,
        padding: tokens.spacingVerticalXS,
        cursor: "pointer",
        borderRadius: tokens.borderRadiusSmall,
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },

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
        //@ts-expect-error TODO: Fix this
        transition: `transform ${tokens.durationNormal} ${tokens.curveEasyInOut}`,
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
    // Custom scrollbar CSS (Remains the same)
    customScroll: {
        "&::-webkit-scrollbar": { width: "10px", height: "10px" },
        "&::-webkit-scrollbar-track": {
            background: "#282828",
            ...shorthands.borderRadius("5px"),
        },
        "&::-webkit-scrollbar-thumb": {
            background: "#555555",
            ...shorthands.borderRadius("5px"),
        },
        "&::-webkit-scrollbar-thumb:hover": { background: "#777777" },
        "&::-webkit-scrollbar-corner": { background: "#1f1f1f" },
    },
});
