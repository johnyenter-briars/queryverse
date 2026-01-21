import { makeStyles } from "@fluentui/react-components";

export const useCustomEditorStyles = makeStyles({
    statusBar: {
        height: "24px",
        backgroundColor: "#1e1e1e",
        color: "#ccc",
        display: "flex",
        alignItems: "center",
        paddingLeft: "10px",
        fontFamily: "monospace",
        borderTop: "1px solid #333",
        flexShrink: 0,
    },
});
