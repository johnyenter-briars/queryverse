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
    shortcutsList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXXS,
        maxHeight: "180px",
        overflowY: "auto",
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: tokens.colorNeutralBackground2,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    shortcutRow: {
        display: "grid",
        gridTemplateColumns: "190px 1fr",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    shortcutKeys: {
        color: tokens.colorBrandForeground1,
        fontFamily: tokens.fontFamilyMonospace,
        fontSize: tokens.fontSizeBase200,
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
