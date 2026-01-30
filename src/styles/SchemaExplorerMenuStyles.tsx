import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useSchemaExplorerMenuStyles = makeStyles({
    body: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    tableList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    tableRow: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
        padding: tokens.spacingVerticalXS,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke2}`),
    },
    tableHeader: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        width: "100%",
    },
    toggleButton: {
        minWidth: "auto",
        padding: 0,
    },
    tableText: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    tableMeta: {
        color: tokens.colorNeutralForeground2,
    },
    attributeList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
        marginLeft: tokens.spacingHorizontalXXL,
        width: "100%",
    },
    attributeRow: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    attributeMeta: {
        color: tokens.colorNeutralForeground3,
    },
    errorText: {
        color: tokens.colorPaletteRedForeground1,
    },
});
