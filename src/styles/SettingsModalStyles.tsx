import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useSettingsModalStyles = makeStyles({
    surface: {
        width: "420px",
        maxWidth: "100%",
    },
    body: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        ...shorthands.padding(tokens.spacingVerticalS, 0),
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    description: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        lineHeight: tokens.lineHeightBase200,
    },
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: tokens.spacingHorizontalS,
        ...shorthands.padding(tokens.spacingVerticalS, 0, 0),
    },
});

