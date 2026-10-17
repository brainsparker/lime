use super::*;
use app_server_protocol::protocol::v2::{ServerNotification, SkillsChangedNotification};
use std::time::Instant;
use tokio::task::AbortHandle;

#[derive(Default)]
struct NotificationState {
    last_notification: Option<Instant>,
    trailing_task: Option<AbortHandle>,
}

#[derive(Clone)]
pub(super) struct CatalogChangeNotifier {
    bridge: AppServerEventBridge,
    pub(super) handle: tokio::runtime::Handle,
    throttle_interval: Duration,
    state: Arc<Mutex<NotificationState>>,
}

impl CatalogChangeNotifier {
    pub(super) fn new(
        bridge: AppServerEventBridge,
        handle: tokio::runtime::Handle,
        throttle_interval: Duration,
    ) -> Self {
        Self {
            bridge,
            handle,
            throttle_interval,
            state: Arc::new(Mutex::new(NotificationState::default())),
        }
    }

    pub(super) fn notify(&self) {
        lime_skills::invalidate_agent_skill_snapshot_cache();
        let now = Instant::now();
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());

        if state.trailing_task.is_some() {
            return;
        }

        let Some(last_notification) = state.last_notification else {
            state.last_notification = Some(now);
            drop(state);
            self.broadcast();
            return;
        };
        let elapsed = now.duration_since(last_notification);
        if elapsed >= self.throttle_interval {
            state.last_notification = Some(now);
            drop(state);
            self.broadcast();
            return;
        }

        let delay = self.throttle_interval - elapsed;
        let notifier = self.clone();
        let task = self.handle.spawn(async move {
            tokio::time::sleep(delay).await;
            notifier.flush_trailing();
        });
        state.trailing_task = Some(task.abort_handle());
    }

    fn flush_trailing(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.trailing_task.take().is_none() {
            return;
        }
        state.last_notification = Some(Instant::now());
        drop(state);
        self.broadcast();
    }

    pub(super) fn cancel_pending(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(task) = state.trailing_task.take() {
            task.abort();
        }
    }

    fn broadcast(&self) {
        let bridge = self.bridge.clone();
        self.handle.spawn(async move {
            bridge
                .broadcast_message(JsonRpcMessage::Notification(
                    ServerNotification::SkillsChanged(SkillsChangedNotification {}).into(),
                ))
                .await;
        });
    }
}
