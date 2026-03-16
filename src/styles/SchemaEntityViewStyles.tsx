import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useSchemaEntityViewStyles = makeStyles({
    root: {
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingHorizontalL),
    },
    header: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    filterBar: {
        display: "flex",
    },
    filterInput: {
        width: "100%",
    },
    sections: {
        display: "flex",
        flexDirection: "row",
        gap: tokens.spacingHorizontalL,
        flex: 1,
        minHeight: 0,
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalM),
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke2}`),
        ...shorthands.borderRadius(tokens.borderRadiusLarge),
        backgroundColor: tokens.colorNeutralBackground2,
    },
    sectionTitle: {
        textTransform: "uppercase",
        letterSpacing: "0.04em",
    },
    rows: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
        overflowY: "auto",
        minHeight: 0,
    },
    row: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
        ...shorthands.padding(tokens.spacingVerticalXS, 0),
        borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
        ":last-child": {
            borderBottom: "none",
        },
    },
    subtle: {
        color: tokens.colorNeutralForeground3,
    },
    status: {
        ...shorthands.padding(tokens.spacingHorizontalL, 0),
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
    },
});
