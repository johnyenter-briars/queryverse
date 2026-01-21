import { makeStyles, shorthands, tokens, webDarkTheme } from "@fluentui/react-components";

export const useTabSwitcherStyles = makeStyles({
    tabSwitcher: {
        position: "fixed",
        top: "72px",
        right: "16px",
        minWidth: "320px",
        maxWidth: "520px",
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        color: webDarkTheme.colorNeutralForeground1,
        ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        boxShadow: tokens.shadow16,
        padding: tokens.spacingVerticalS,
        zIndex: 1000,
    },
    tabSwitcherItem: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusSmall,
    },
    tabSwitcherItemActive: {
        backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    tabSwitcherTitle: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
    },
});
