import { makeStyles, shorthands, tokens, webDarkTheme } from "@fluentui/react-components";

const DRAWER_WIDTH = "300px";

export const useConnectionsMenuStyles = makeStyles({
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
    section: {
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke2}`),
        ...shorthands.borderRadius(tokens.borderRadiusLarge),
        ...shorthands.padding(tokens.spacingHorizontalM),
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        boxShadow: tokens.shadow4,
    },
    sectionHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalS,
    },
    sectionTitle: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    sectionSubtitle: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    sectionDivider: {
        marginTop: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalXS,
    },
    list: {
        ...shorthands.padding(0),
    },
    connectionRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        cursor: "pointer",
        transitionProperty: "background-color, color",
        transitionDuration: tokens.durationFast,
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        width: "100%",
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
        "&:active": {
            backgroundColor: tokens.colorNeutralBackground1Pressed,
        },
    },
    connectionName: {
        color: tokens.colorNeutralForeground1,
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        lineHeight: tokens.lineHeightBase300,
        flex: 1,
    },
    emptyState: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        paddingTop: tokens.spacingVerticalS,
        paddingBottom: tokens.spacingVerticalS,
    },
});
