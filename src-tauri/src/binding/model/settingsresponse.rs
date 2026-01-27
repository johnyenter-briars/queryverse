use crate::binding::model::{qvresponse::QVResponse, settings::Settings};

pub type SettingsResponse = QVResponse<Settings>;

impl SettingsResponse {
    pub fn success(settings: Settings) -> Self {
        QVResponse {
            message: "Success".to_string(),
            success: true,
            value: settings,
        }
    }
}

