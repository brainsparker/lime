use crate::protocol::AgentEvent;
use std::sync::{Arc, Mutex};

type PublishCommand = dyn Fn(&AgentEvent) -> Result<(), String> + Send + Sync;

/// Owned host capability for command events that can outlive a provider Turn.
#[derive(Clone)]
pub struct CommandEventPublisher {
    publish: Arc<PublishCommand>,
    error: Arc<Mutex<Option<String>>>,
}

impl std::fmt::Debug for CommandEventPublisher {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CommandEventPublisher")
            .finish_non_exhaustive()
    }
}

impl CommandEventPublisher {
    pub fn new(
        publish: impl Fn(&AgentEvent) -> Result<(), String> + Send + Sync + 'static,
    ) -> Self {
        Self {
            publish: Arc::new(publish),
            error: Arc::new(Mutex::new(None)),
        }
    }

    pub(super) fn publish(&self, event: &AgentEvent) {
        if let Err(error) = (self.publish)(event) {
            self.error
                .lock()
                .expect("command publisher error mutex poisoned")
                .get_or_insert(error);
        }
    }

    pub(super) fn error(&self) -> Option<String> {
        self.error
            .lock()
            .expect("command publisher error mutex poisoned")
            .clone()
    }
}
