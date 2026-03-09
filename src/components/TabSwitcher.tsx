import { useEffect, useMemo, useState } from "react";
import { combineClasses } from "../utility/class";
import { useTabSwitcherStyles } from "../styles/TabSwitcherStyles";
import {
    getTabSwitchDirection,
    isTabSwitchModifierRelease,
} from "../settings/shortcuts";

type TabInfo = {
    id: number;
    title: string;
};

type TabSwitchState = {
    isCycling: boolean;
    pressCount: number;
    index: number;
    show: boolean;
    list: number[];
};

const DEFAULT_TAB_SWITCH_STATE: TabSwitchState = {
    isCycling: false,
    pressCount: 0,
    index: 0,
    show: false,
    list: [],
};

const getNextTabSwitchIndex = (
    currentIndex: number,
    listLength: number,
    direction: -1 | 1,
    isCycling: boolean
): number => {
    if (!isCycling) {
        return direction > 0 ? 1 % listLength : listLength - 1;
    }

    return (currentIndex + direction + listLength) % listLength;
};

interface TabSwitcherProps {
    tabs: TabInfo[];
    activeTabId: number;
    onTabSelect: (id: number) => void;
}

export function TabSwitcher({ tabs, activeTabId, onTabSelect }: TabSwitcherProps) {
    const styles = useTabSwitcherStyles();
    const [tabMru, setTabMru] = useState<number[]>([]);
    const [tabSwitch, setTabSwitch] = useState<TabSwitchState>(DEFAULT_TAB_SWITCH_STATE);

    useEffect(() => {
        const existingIds = new Set(tabs.map((tab) => tab.id));
        setTabMru((prev) => {
            const filtered = prev.filter((id) => existingIds.has(id));
            const missing = tabs.map((tab) => tab.id).filter((id) => !filtered.includes(id));
            return [...filtered, ...missing];
        });
    }, [tabs]);

    useEffect(() => {
        if (activeTabId === 0 || tabSwitch.isCycling) return;
        setTabMru((prev) => {
            const without = prev.filter((id) => id !== activeTabId);
            return [activeTabId, ...without];
        });
    }, [activeTabId, tabSwitch.isCycling]);

    useEffect(() => {
        if (tabs.length < 2 && tabSwitch.isCycling) {
            setTabSwitch(DEFAULT_TAB_SWITCH_STATE);
        }
    }, [tabs.length, tabSwitch.isCycling]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const direction = getTabSwitchDirection(event);
            if (direction === 0) return;
            if (tabMru.length < 2) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            setTabSwitch((prev) => {
                const list = prev.isCycling ? prev.list : tabMru;
                const nextIndex = getNextTabSwitchIndex(
                    prev.index,
                    list.length,
                    direction,
                    prev.isCycling
                );
                const nextPressCount = prev.isCycling ? prev.pressCount + 1 : 1;
                const nextShow = nextPressCount > 1;
                const nextId = list[nextIndex];
                if (nextId) {
                    onTabSelect(nextId);
                }
                return {
                    isCycling: true,
                    pressCount: nextPressCount,
                    index: nextIndex,
                    show: nextShow,
                    list,
                };
            });
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (!isTabSwitchModifierRelease(event)) return;
            setTabSwitch(DEFAULT_TAB_SWITCH_STATE);
        };

        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("keyup", handleKeyUp, true);
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("keyup", handleKeyUp, true);
        };
    }, [tabMru, onTabSelect]);

    const tabMap = useMemo(() => new Map(tabs.map((tab) => [tab.id, tab])), [tabs]);
    const tabSwitchList =
        tabSwitch.isCycling && tabSwitch.list.length > 0 ? tabSwitch.list : tabMru;

    if (!tabSwitch.show || tabSwitchList.length < 2) {
        return null;
    }

    return (
        <div className={styles.tabSwitcher} role="listbox" aria-label="Tabs">
            {tabSwitchList.map((id, index) => {
                const tab = tabMap.get(id);
                if (!tab) return null;
                const itemClasses = combineClasses(
                    styles.tabSwitcherItem,
                    index === tabSwitch.index && styles.tabSwitcherItemActive
                );
                return (
                    <div key={id} className={itemClasses} aria-selected={index === tabSwitch.index}>
                        <span className={styles.tabSwitcherTitle}>{tab.title}</span>
                    </div>
                );
            })}
        </div>
    );
}
