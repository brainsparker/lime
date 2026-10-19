use super::{RuntimeSessionInput, RuntimeSessionInputActivity, RuntimeSessionInputHandle};
use std::sync::Arc;

/// 在 actor 确认的 Turn 上持久化输入；成功后输入才对模型循环可见。
#[derive(Clone)]
pub struct RuntimeSessionInputCommit {
    commit: Arc<dyn Fn(&str) -> Result<(), String> + Send + Sync>,
}

impl RuntimeSessionInputCommit {
    pub fn new(commit: impl Fn(&str) -> Result<(), String> + Send + Sync + 'static) -> Self {
        Self {
            commit: Arc::new(commit),
        }
    }
}

impl RuntimeSessionInputHandle {
    pub(in crate::session_loop) async fn push_steer_with_commit(
        &self,
        input: Vec<RuntimeSessionInput>,
        commit: Option<&RuntimeSessionInputCommit>,
    ) -> Result<bool, String> {
        let mut state = self.state.input.lock().await;
        if state.finishing {
            return Ok(false);
        }
        // 同一 guard 串行化持久化、消费和 finishing；commit 失败时不改变队列或投递阶段。
        if let Some(commit) = commit {
            (commit.commit)(&self.turn_id)?;
        }
        state.steer.extend(input);
        state.mailbox_delivery_phase = super::RuntimeSessionMailboxDeliveryPhase::CurrentTurn;
        drop(state);
        self.pending_input
            .publish_activity(RuntimeSessionInputActivity::Steer);
        Ok(true)
    }
}
