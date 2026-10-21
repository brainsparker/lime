//! Desktop 偏好；与其它 Surface 共享 App Server 用户配置层。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LinkOpenTarget {
    InAppBrowser,
    ExternalBrowser,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExternalBrowserLinkShortcut {
    Unassigned,
    #[default]
    Primary,
    Alt,
    PrimaryShift,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "kebab-case")]
pub struct DesktopConfig {
    // 空值保留未显式配置的身份，不能被schema默认值覆盖。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_link_in_target_preference: Option<LinkOpenTarget>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_local_url_in_target_preference: Option<LinkOpenTarget>,
    pub external_browser_link_shortcut: ExternalBrowserLinkShortcut,
}

impl DesktopConfig {
    pub fn is_default(&self) -> bool {
        self == &Self::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn desktop_link_preferences_preserve_unconfigured_identity() {
        let config: DesktopConfig = serde_json::from_value(json!({})).unwrap();
        assert!(config.is_default());
        assert_eq!(config.open_link_in_target_preference, None);
        assert_eq!(config.open_local_url_in_target_preference, None);
        assert_eq!(config.external_browser_link_shortcut, ExternalBrowserLinkShortcut::Primary);
        assert_eq!(serde_json::to_value(config).unwrap(), json!({
            "external-browser-link-shortcut": "primary"
        }));
    }

    #[test]
    fn desktop_link_preferences_round_trip_without_coupling_destinations() {
        for web in ["in-app-browser", "external-browser"] {
            for local in ["in-app-browser", "external-browser"] {
                for shortcut in ["unassigned", "primary", "alt", "primary-shift"] {
                    let value = json!({
                        "open-link-in-target-preference": web,
                        "open-local-url-in-target-preference": local,
                        "external-browser-link-shortcut": shortcut
                    });
                    let config: DesktopConfig = serde_json::from_value(value.clone()).unwrap();
                    let yaml = serde_yaml::to_string(&config).unwrap();
                    let restored: DesktopConfig = serde_yaml::from_str(&yaml).unwrap();
                    assert_eq!(serde_json::to_value(restored).unwrap(), value);
                }
            }
        }
    }

    #[test]
    fn desktop_link_preferences_reject_unknown_or_invalid_settings() {
        for value in [
            json!({"open-link-in-target-preference": "browser"}),
            json!({"open-local-url-in-target-preference": true}),
            json!({"external-browser-link-shortcut": "control"}),
            json!({"external-browser-link-shortcut": null}),
            json!({"unknown-link-preference": "in-app-browser"}),
        ] {
            assert!(serde_json::from_value::<DesktopConfig>(value.clone()).is_err(), "{value}");
        }
    }
}
