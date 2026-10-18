//! Typed plugin Hook components and their current loader boundary.

use crate::hook_config::HookEventsConfig;
use crate::turn_snapshot::RuntimeHookEventName;
use std::fmt;
use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginHookSource {
    pub plugin_id: String,
    pub plugin_root: PathBuf,
    pub plugin_data_root: PathBuf,
    pub source_path: PathBuf,
    pub source_relative_path: String,
    pub hooks: HookEventsConfig,
}

impl PluginHookSource {
    pub fn declarations(&self) -> Vec<(String, RuntimeHookEventName)> {
        let mut declarations = Vec::new();
        for (event, groups) in self.hooks.clone().into_groups() {
            for (group_index, group) in groups.iter().enumerate() {
                for handler_index in 0..group.hooks.len() {
                    declarations.push((
                        format!(
                            "{}:{}:{}:{group_index}:{handler_index}",
                            self.plugin_id,
                            self.source_relative_path,
                            event.key_label()
                        ),
                        event,
                    ));
                }
            }
        }
        declarations
    }
}

#[derive(Debug, Clone, Default)]
pub struct PluginHookLoadOutcome {
    pub sources: Vec<PluginHookSource>,
    pub warnings: Vec<String>,
}

pub type PluginHookLoadFuture<'a> =
    Pin<Box<dyn Future<Output = Result<PluginHookLoadOutcome, String>> + Send + 'a>>;

pub trait PluginHookSourceProvider: Send + Sync {
    fn load(&self) -> PluginHookLoadFuture<'_>;
}

#[derive(Clone)]
pub struct PluginHookSourceProviderHandle(Arc<dyn PluginHookSourceProvider>);

impl PluginHookSourceProviderHandle {
    pub fn new(source: Arc<dyn PluginHookSourceProvider>) -> Self {
        Self(source)
    }

    pub async fn load(&self) -> Result<PluginHookLoadOutcome, String> {
        self.0.load().await
    }
}

impl fmt::Debug for PluginHookSourceProviderHandle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("PluginHookSourceProviderHandle(..)")
    }
}
