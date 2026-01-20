import { useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    makeStyles,
    shorthands,
    tokens,
    Button,
} from "@fluentui/react-components";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";

import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
import { combineClasses } from "./utility/class";
import { Entity } from "./binding/model/Entity";
import { FetchXmlPreview } from "./binding/model/FetchXmlPreview";
import { executeSql, previewFetchXml } from "./binding/backend";

const DRAWER_WIDTH = "300px";

const useStyles = makeStyles({
    // Global App Layout
    root: {
        ...shorthands.padding(0),
        ...shorthands.margin(0),
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: webDarkTheme.colorNeutralBackground1,
        color: webDarkTheme.colorNeutralForeground1,
        overflow: "hidden",
    },
    // Main Wrapper for the Flyout and Content Area
    wrapper: {
        flex: 1,
        display: "flex",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
    },
    
    // BASE Content Area Style (ALWAYS applied)
    contentArea: {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flexGrow: 1,
        transitionDuration: tokens.durationNormal,
        transitionProperty: "margin-left, width",
        width: "100%", 
        marginLeft: "0", 
    },
    // SHIFTED Class (Applied conditionally for dynamic effect)
    contentShifted: {
        marginLeft: DRAWER_WIDTH,
        width: `calc(100% - ${DRAWER_WIDTH})`,
    },

    // Placeholder Sections
    top: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        overflow: "hidden",
        padding: tokens.spacingHorizontalS,
    },
    bottom: {
        flex: 1,
        overflowY: "auto",
        padding: tokens.spacingHorizontalM,
    },
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
    executeError: {
        color: tokens.colorPaletteRedForeground1,
        marginBottom: tokens.spacingVerticalS,
    },
    
    // BASE Flyout Style (ALWAYS applied - handles hidden state/transition)
    flyoutBase: {
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: webDarkTheme.colorNeutralBackground2,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        // Initial state: hidden off-screen to the left
        transform: `translateX(-${DRAWER_WIDTH})`,
		//@ts-expect-error TODO: Fix this
        transition: `transform ${tokens.durationNormal} ${tokens.curveEasyInOut}`,
        ...shorthands.borderRight(`1px solid ${tokens.colorNeutralStroke1}`),
    },
    // OPEN Class (Applied conditionally to override transform to visible state)
    flyoutOpen: {
        transform: "translateX(0)", 
    },

    flyoutHalf: {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        ...shorthands.padding(tokens.spacingHorizontalM),
    },
    // Custom scrollbar CSS (Remains the same)
    customScroll: {
        "&::-webkit-scrollbar": { width: "10px", height: "10px" },
        "&::-webkit-scrollbar-track": { background: "#282828", ...shorthands.borderRadius("5px") },
        "&::-webkit-scrollbar-thumb": { background: "#555555", ...shorthands.borderRadius("5px") },
        "&::-webkit-scrollbar-thumb:hover": { background: "#777777" },
        "&::-webkit-scrollbar-corner": { background: "#1f1f1f" },
    },
});

export default function App() {
    const [connectionsEnabled, setIsMenuOpen] = useState(true); 
    const [vimEnabled, setVimEnabled] = useState(true); 
    const [queryText, setQueryText] = useState("select top 20 *\nfrom accounts");
    const [results, setResults] = useState<Entity[]>([]);
    const [fetchPreview, setFetchPreview] = useState<FetchXmlPreview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [executeError, setExecuteError] = useState<string | null>(null);

    const styles = useStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        connectionsEnabled && styles.contentShifted
    );

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === "string") return error;
        return "Unknown error";
    };

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <MenuBar
                    vimEnabled={vimEnabled}
					connectionsEnabled={connectionsEnabled}
                    onToggleVimEnabled={() => setVimEnabled(!vimEnabled)} 
                    onToggleConnections={() => setIsMenuOpen(!connectionsEnabled)} 
                    onExecuteSql={async () => {
                        try {
                            const response = await executeSql(queryText);
                            setResults(response.value);
                            setExecuteError(null);
                        } catch (error) {
                            setExecuteError(getErrorMessage(error));
                        }
                    }}
                    onPreviewFetchXml={async () => {
                        try {
                            const response = await previewFetchXml(queryText);
                            setFetchPreview(response);
                            setPreviewError(null);
                        } catch (error) {
                            setFetchPreview(null);
                            setPreviewError(getErrorMessage(error));
                        }
                    }}
                />

                <div className={styles.wrapper}>
                    <ConnectionsMenu isOpen={connectionsEnabled} />

                    <div className={contentClasses}> 
                        
                        <div className={styles.top}>
							<CustomEditor
								vimEnabled={vimEnabled}
                                value={queryText}
                                onChange={setQueryText}
							/>
                        </div>

                        <div className={styles.bottom}>
                            {(fetchPreview || previewError) && (
                                <div className={styles.previewPanel}>
                                    <div className={styles.previewHeader}>
                                        <span>FetchXML Preview</span>
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            onClick={() => {
                                                setFetchPreview(null);
                                                setPreviewError(null);
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                    <pre
                                        className={combineClasses(
                                            styles.previewBody,
                                            previewError ? styles.previewError : undefined
                                        )}
                                    >
                                        {previewError ?? fetchPreview?.fetchXml}
                                    </pre>
                                    {fetchPreview?.entityLogical && (
                                        <div className={styles.previewMeta}>
                                            Entity: {fetchPreview.entityLogical} (set: {fetchPreview.entitySet})
                                        </div>
                                    )}
                                </div>
                            )}
                            {executeError && (
                                <div className={styles.executeError}>
                                    {executeError}
                                </div>
                            )}
							<ResultsWindow data={results} />
                        </div>
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}
