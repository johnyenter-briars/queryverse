import { makeStyles, shorthands, tokens, webDarkTheme } from "@fluentui/react-components";

export const useResultsWindowStyles = makeStyles({
    root: {
        position: "relative",
        width: "100%",
        height: "100%",
        scrollbarColor: `${tokens.colorBrandBackground} ${tokens.colorNeutralBackground2}`,
        scrollbarWidth: "thin",
        "& *": {
            scrollbarColor: `${tokens.colorBrandBackground} ${tokens.colorNeutralBackground2}`,
            scrollbarWidth: "thin",
        },
        "& .fui-DataGridHeader": {
            overflow: "hidden",
            scrollbarWidth: "none",
        },
        "& .fui-DataGridHeader::-webkit-scrollbar": {
            display: "none",
        },
        "& ::-webkit-scrollbar": {
            width: "12px",
            height: "12px",
        },
        "& ::-webkit-scrollbar-track": {
            backgroundColor: tokens.colorNeutralBackground2,
        },
        "& ::-webkit-scrollbar-thumb": {
            backgroundColor: tokens.colorBrandBackground,
            borderRadius: tokens.borderRadiusMedium,
            border: `3px solid ${tokens.colorNeutralBackground2}`,
        },
        "& ::-webkit-scrollbar-thumb:hover": {
            backgroundColor: tokens.colorBrandBackgroundHover,
        },
        "& ::-webkit-scrollbar-corner": {
            backgroundColor: tokens.colorNeutralBackground2,
        },
    },
    cellContent: {
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    contextMenu: {
        position: "fixed",
        minWidth: "160px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        boxShadow: tokens.shadow16,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.padding(tokens.spacingVerticalXS),
        zIndex: 1000,
    },
    contextMenuButton: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        backgroundColor: "transparent",
        color: tokens.colorNeutralForeground1,
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        ...shorthands.borderRadius(tokens.borderRadiusSmall),
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    contextMenuButtonDisabled: {
        color: tokens.colorNeutralForegroundDisabled,
        cursor: "default",
        "&:hover": {
            backgroundColor: "transparent",
        },
    },
});
