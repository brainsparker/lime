use super::*;

pub(super) struct DynamicToolHost {
    pub(super) connection_id: ConnectionId,
    tools: HashSet<(Option<String>, String)>,
}

impl ThreadStateManager {
    pub(crate) async fn bind_dynamic_tool_host(
        &self,
        thread_id: ThreadId,
        connection_id: ConnectionId,
        tools: HashSet<(Option<String>, String)>,
        active_turn: bool,
    ) -> Result<(), &'static str> {
        let mut inner = self.inner.lock().await;
        if inner.listeners_shutting_down || !inner.live_connections.contains(&connection_id) {
            return Err("dynamic tool host connection is not live");
        }
        let entry = inner.threads.entry(thread_id).or_default();
        if entry.unloading {
            return Err("dynamic tool host cannot bind while the thread is unloading");
        }
        if let Some(host) = entry.dynamic_tool_host.as_ref() {
            return if host.connection_id == connection_id && host.tools == tools {
                Ok(())
            } else {
                Err("dynamic tools are already bound to a different host or capability set")
            };
        }
        if active_turn {
            return Err("dynamic tool host cannot be rebound during an active turn");
        }
        entry.dynamic_tool_host = Some(DynamicToolHost {
            connection_id,
            tools,
        });
        Ok(())
    }

    pub(crate) async fn with_dynamic_tool_host<T>(
        &self,
        thread_id: &ThreadId,
        namespace: Option<&str>,
        tool: &str,
        register: impl FnOnce(ConnectionId) -> T,
    ) -> Option<T> {
        let inner = self.inner.lock().await;
        let host = inner.threads.get(thread_id)?.dynamic_tool_host.as_ref()?;
        (inner.live_connections.contains(&host.connection_id)
            && host
                .tools
                .contains(&(namespace.map(str::to_owned), tool.to_owned())))
        .then(|| register(host.connection_id))
    }
}
