use crate::AppDataSource;
use std::sync::Arc;
use tool_runtime::hook_source::{
    PluginHookLoadFuture, PluginHookSourceProvider, PluginHookSourceProviderHandle,
};

pub(super) fn source(
    data: Option<Arc<dyn AppDataSource>>,
) -> Option<PluginHookSourceProviderHandle> {
    data.map(|data| PluginHookSourceProviderHandle::new(Arc::new(CurrentPluginHookSource { data })))
}

struct CurrentPluginHookSource {
    data: Arc<dyn AppDataSource>,
}

impl PluginHookSourceProvider for CurrentPluginHookSource {
    fn load(&self) -> PluginHookLoadFuture<'_> {
        Box::pin(async move {
            self.data
                .load_plugin_hooks()
                .await
                .map_err(|error| error.to_string())
        })
    }
}
