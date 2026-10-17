use super::RequestProcessor;
use app_server_protocol::protocol::v2::Thread;

impl RequestProcessor {
    pub(in crate::processor) async fn refresh_plugin_skill_watch(&self) {
        let Some(watcher) = &self.skills_watcher else {
            return;
        };
        let mut registration = self.plugin_skill_watch.lock().await;
        match self.runtime.plugin_skill_roots().await {
            Ok(roots) => {
                *registration =
                    Some(watcher.register_roots(roots.into_iter().map(|root| root.path)));
            }
            Err(error) => tracing::warn!(%error, "failed to resolve Plugin Skill watch scope"),
        }
    }

    pub(in crate::processor) async fn refresh_thread_skill_watch(&self, thread_id: &str) {
        if self.skills_watcher.is_none() {
            return;
        }
        match self
            .runtime
            .read_thread(agent_protocol::thread::ThreadReadParams {
                thread_id: agent_protocol::ThreadId::new(thread_id),
                turns_view: agent_protocol::ThreadTurnsView::NotLoaded,
            })
            .await
        {
            Ok(response) => {
                match super::super::thread::projection::project_thread_read_response(response) {
                    Ok(response) => self.watch_thread_skills(&response.thread).await,
                    Err(error) => {
                        tracing::warn!(thread_id, ?error, "failed to refresh Skill watch scope")
                    }
                }
            }
            Err(error) => tracing::warn!(thread_id, %error, "failed to read Skill watch scope"),
        }
    }

    pub(in crate::processor) async fn watch_thread_skills(&self, thread: &Thread) {
        let Some(watcher) = &self.skills_watcher else {
            return;
        };
        let metadata = thread.extra.as_ref();
        // Remote environment paths cannot be observed by the host filesystem watcher.
        let remote_environment = metadata
            .and_then(|metadata| metadata.get("environments"))
            .and_then(serde_json::Value::as_array)
            .is_some_and(|environments| !environments.is_empty());
        let registration = if remote_environment {
            None
        } else {
            let Some(session_id) = self.runtime.loaded_session_id_for_thread(&thread.id) else {
                return;
            };
            let roots = match self.runtime.session_skill_roots(&session_id) {
                Ok(roots) => roots,
                Err(error) => {
                    tracing::warn!(thread_id = thread.id, %error, "failed to resolve Skill watch scope");
                    return;
                }
            };
            Some(watcher.register_roots(roots.into_iter().map(|root| root.path)))
        };
        self.thread_states
            .set_skill_watch(
                agent_protocol::ThreadId::new(thread.id.clone()),
                registration,
            )
            .await;
    }
}
