export interface Settings {
    vimEnabled: boolean;
    keyBindingsEnabled: boolean;
    fontSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
    vimEnabled: true,
    keyBindingsEnabled: true,
    fontSize: 16,
};

