import { makeStyles, shorthands, tokens, webDarkTheme } from "@fluentui/react-components";

export const useResultsWindowStyles = makeStyles({
    root: {
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: webDarkTheme.colorNeutralBackground1,
        scrollbarColor: `${tokens.colorBrandBackground} ${tokens.colorNeutralBackground2}`,
        scrollbarWidth: "thin",
        "& *": {
            scrollbarColor: `${tokens.colorBrandBackground} ${tokens.colorNeutralBackground2}`,
            scrollbarWidth: "thin",
        },
        "& .fui-DataGrid": {
            height: "100%",
            backgroundColor: webDarkTheme.colorNeutralBackground1,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
        },
        "& .fui-DataGridHeader": {
            overflow: "hidden",
            scrollbarWidth: "none",
        },
        "& .fui-DataGridHeader::-webkit-scrollbar": {
            display: "none",
        },
        "& .fui-DataGridHeaderCell": {
            borderRight: "none",
            boxSizing: "border-box",
            boxShadow: `inset -1px 0 0 ${tokens.colorNeutralStroke2}`,
            ...shorthands.padding(0),
        },
        "& .fui-DataGridHeaderCell:last-child": {
            boxShadow: "none",
        },
        "& .fui-DataGridBody": {
            overflowX: "auto",
            overflowY: "auto",
        },
        "& .fui-DataGridRow": {
            borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        },
        "& .fui-DataGridBody .fui-DataGridRow:nth-child(odd)": {
            backgroundColor: webDarkTheme.colorNeutralBackground1,
        },
        "& .fui-DataGridBody .fui-DataGridRow:nth-child(even)": {
            backgroundColor: webDarkTheme.colorNeutralBackground2,
        },
        "& .fui-DataGridBody .fui-DataGridRow:hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
        "& .fui-DataGridBody .fui-DataGridRow:focus-within": {
            backgroundColor: tokens.colorNeutralBackground1Pressed,
        },
        "& .fui-DataGridCell": {
            minHeight: "36px",
            boxSizing: "border-box",
            boxShadow: `inset -1px 0 0 ${tokens.colorNeutralStroke2}`,
            userSelect: "none",
            ...shorthands.padding(0),
        },
        "& .fui-DataGridCell:last-child": {
            boxShadow: "none",
        },
        "& .fui-TableCellLayout": {
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            userSelect: "none",
            ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
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
    loadingOverlay: {
        position: "absolute",
        right: tokens.spacingHorizontalM,
        bottom: tokens.spacingHorizontalM,
        display: "flex",
        pointerEvents: "none",
        zIndex: 20,
    },
    loadingCard: {
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: tokens.colorNeutralBackground3,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: tokens.shadow16,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    },
    detailsList: {
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        ...shorthands.padding(tokens.spacingVerticalS, 0),
    },
    progressCardShell: {
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        height: "100%",
        overflowY: "auto",
        ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXXL),
    },
    progressCard: {
        width: "100%",
        maxWidth: "720px",
        backgroundColor: tokens.colorNeutralBackground2,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusXLarge,
        boxShadow: tokens.shadow16,
        overflow: "hidden",
    },
    detailsRow: {
        display: "grid",
        gridTemplateColumns: "220px minmax(0, 1fr)",
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    detailsRowLast: {
        borderBottom: "none",
    },
    detailsKey: {
        fontWeight: tokens.fontWeightSemibold,
        boxShadow: `inset -1px 0 0 ${tokens.colorNeutralStroke2}`,
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    },
    detailsValue: {
        minWidth: 0,
        wordBreak: "break-word",
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    },
    cellContent: {
        display: "block",
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        userSelect: "none",
    },
    headerContent: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: "100%",
        minWidth: 0,
        fontWeight: tokens.fontWeightSemibold,
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
    },
});
