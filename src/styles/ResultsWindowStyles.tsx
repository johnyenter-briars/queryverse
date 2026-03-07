import { makeStyles, tokens } from "@fluentui/react-components";

export const useResultsWindowStyles = makeStyles({
    root: {
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
});
