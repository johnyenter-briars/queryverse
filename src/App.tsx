import { useState } from "react";
import {
    FluentProvider,
    webDarkTheme,
    makeStyles,
    shorthands,
    tokens,
} from "@fluentui/react-components";
import { ResultsWindow } from "./components/ResultsWindow";
import { CustomEditor } from "./components/CustomEditor";

import { MenuBar } from "./components/MenuBar";
import { ConnectionsMenu } from "./components/ConnectionsMenu";
import { combineClasses } from "./utility/class";

const DRAWER_WIDTH = "300px";

// All styles are static definitions. useStyles() will return an object 
// where keys map to static class names.
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

    const styles = useStyles();

    const contentClasses = combineClasses(
        styles.contentArea,
        connectionsEnabled && styles.contentShifted
    );

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.root}>
                <MenuBar
                    vimEnabled={vimEnabled}
					connectionsEnabled={connectionsEnabled}
                    onToggleVimEnabled={() => setVimEnabled(!vimEnabled)} 
                    onToggleConnections={() => setIsMenuOpen(!connectionsEnabled)} 
                />

                <div className={styles.wrapper}>
                    <ConnectionsMenu isOpen={connectionsEnabled} />

                    <div className={contentClasses}> 
                        
                        <div className={styles.top}>
							<CustomEditor
								vimEnabled={vimEnabled}
							/>
                        </div>

                        <div className={styles.bottom}>
							<ResultsWindow />
                        </div>
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}
