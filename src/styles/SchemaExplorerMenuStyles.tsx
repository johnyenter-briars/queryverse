import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useSchemaExplorerMenuStyles = makeStyles({
    body: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    filterInput: {
        width: "100%",
    },
    connectionSelect: {
        backgroundColor: tokens.colorNeutralBackground1,
        color: tokens.colorNeutralForeground1,
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke1}`),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        width: "100%",
    },
    tableList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    entityButton: {
        justifyContent: "flex-start",
        alignItems: "flex-start",
        textAlign: "left",
        width: "100%",
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
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
        gap: tokens.spacingVerticalM,
        marginLeft: tokens.spacingHorizontalXXL,
        width: "100%",
    },
    metadataPanel: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        marginLeft: tokens.spacingHorizontalXXL,
        width: "100%",
    },
    metadataSection: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
        paddingTop: tokens.spacingVerticalXS,
    },
    sectionLabel: {
        color: tokens.colorNeutralForeground2,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
    },
    attributeRow: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
    },
    relationshipRow: {
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
    emptyState: {
        color: tokens.colorNeutralForeground3,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    },
});
