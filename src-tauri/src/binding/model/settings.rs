use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub vim_enabled: bool,
    pub key_bindings_enabled: bool,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_fetchxml_single_quotes")]
    pub fetch_xml_single_quotes: bool,
    #[serde(default)]
    pub bypass_business_logic_execution_custom_sync: bool,
    #[serde(default)]
    pub bypass_business_logic_execution_custom_async: bool,
    #[serde(default)]
    pub bypass_custom_plugin_execution: bool,
    #[serde(default)]
    pub suppress_callback_registration_expander_job: bool,
    #[serde(default = "default_dataverse_default_batch_size")]
    pub dataverse_default_batch_size: u32,
}

fn default_font_size() -> u32 {
    16
}

fn default_fetchxml_single_quotes() -> bool {
    true
}

fn default_dataverse_default_batch_size() -> u32 {
    200
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            vim_enabled: true,
            key_bindings_enabled: true,
            font_size: default_font_size(),
            fetch_xml_single_quotes: default_fetchxml_single_quotes(),
            bypass_business_logic_execution_custom_sync: false,
            bypass_business_logic_execution_custom_async: false,
            bypass_custom_plugin_execution: false,
            suppress_callback_registration_expander_job: false,
            dataverse_default_batch_size: default_dataverse_default_batch_size(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Settings;

    #[test]
    fn default_settings_match_expected_defaults() {
        let settings = Settings::default();
        assert!(settings.vim_enabled);
        assert!(settings.key_bindings_enabled);
        assert_eq!(settings.font_size, 16);
        assert!(settings.fetch_xml_single_quotes);
        assert_eq!(settings.dataverse_default_batch_size, 200);
        assert!(!settings.bypass_business_logic_execution_custom_sync);
        assert!(!settings.bypass_business_logic_execution_custom_async);
        assert!(!settings.bypass_custom_plugin_execution);
        assert!(!settings.suppress_callback_registration_expander_job);
    }
}
