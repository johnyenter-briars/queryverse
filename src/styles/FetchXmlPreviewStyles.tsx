import { makeStyles, shorthands, tokens, webDarkTheme } from "@fluentui/react-components";

export const useFetchXmlPreviewStyles = makeStyles({
    previewPanel: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        ...shorthands.border(`1px solid ${tokens.colorNeutralStroke1}`),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        marginBottom: tokens.spacingVerticalM,
        minHeight: 0,
    },
    previewHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalM),
        ...shorthands.borderBottom(`1px solid ${tokens.colorNeutralStroke1}`),
    },
    previewBody: {
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        overflowY: "auto",
        maxHeight: "200px",
        ...shorthands.padding(tokens.spacingHorizontalM),
    },
    previewError: {
        color: tokens.colorPaletteRedForeground1,
    },
    previewMeta: {
        color: tokens.colorNeutralForeground2,
        ...shorthands.padding(tokens.spacingHorizontalM, tokens.spacingHorizontalM),
        ...shorthands.borderTop(`1px solid ${tokens.colorNeutralStroke1}`),
    },
});
