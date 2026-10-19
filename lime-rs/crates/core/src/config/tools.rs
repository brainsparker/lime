use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ToolsConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub experimental_request_user_input: Option<ExperimentalRequestUserInput>,
}

impl ToolsConfig {
    pub fn is_default(&self) -> bool {
        self.experimental_request_user_input.is_none()
    }

    pub fn experimental_request_user_input_enabled(&self) -> bool {
        self.experimental_request_user_input
            .as_ref()
            .is_none_or(|config| config.enabled)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExperimentalRequestUserInput {
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_user_input_is_enabled_by_default_and_can_be_disabled() {
        for value in [
            serde_json::json!({}),
            serde_json::json!({"experimental_request_user_input": {}}),
        ] {
            let tools: ToolsConfig = serde_json::from_value(value).unwrap();
            assert!(tools.experimental_request_user_input_enabled());
        }
        let tools: ToolsConfig = serde_json::from_value(
            serde_json::json!({"experimental_request_user_input": {"enabled": false}}),
        )
        .unwrap();
        assert!(!tools.experimental_request_user_input_enabled());
    }
}
