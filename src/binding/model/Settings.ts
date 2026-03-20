export interface Settings {
    vimEnabled: boolean;
    keyBindingsEnabled: boolean;
    fontSize: number;
    fetchXmlSingleQuotes: boolean;
    bypassBusinessLogicExecutionCustomSync: boolean;
    bypassBusinessLogicExecutionCustomAsync: boolean;
    bypassCustomPluginExecution: boolean;
    suppressCallbackRegistrationExpanderJob: boolean;
    dataverseDefaultBatchSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
    vimEnabled: true,
    keyBindingsEnabled: true,
    fontSize: 16,
    fetchXmlSingleQuotes: true,
    bypassBusinessLogicExecutionCustomSync: false,
    bypassBusinessLogicExecutionCustomAsync: false,
    bypassCustomPluginExecution: false,
    suppressCallbackRegistrationExpanderJob: false,
    dataverseDefaultBatchSize: 200,
};

