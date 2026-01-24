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
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        padding: tokens.spacingVerticalXS,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke2}`),
    },
    tableText: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    tableMeta: {
        color: tokens.colorNeutralForeground2,
    },
    errorText: {
        color: tokens.colorPaletteRedForeground1,
    },
});
