//! Session Command projection retains its original Turn/process scope after model completion.

use super::{ConversationProjection, EntryStatus};
use app_server_protocol::protocol::v2::{
    CommandExecutionSource, CommandExecutionStatus, ThreadItem, TurnStatus,
};

#[derive(Debug, Clone)]
pub(super) struct CommandScope {
    turn_id: String,
    process_id: Option<String>,
    session_owned: bool,
    completed: bool,
}

pub(super) fn session_command_is_running(item: &ThreadItem) -> bool {
    matches!(item, ThreadItem::CommandExecution {
        source: CommandExecutionSource::UnifiedExecStartup,
        status: CommandExecutionStatus::InProgress, process_id: Some(id), ..
    } if !id.is_empty())
}

impl ConversationProjection {
    pub(super) fn observe_command(&mut self, turn_id: &str, item: &ThreadItem) -> bool {
        let ThreadItem::CommandExecution {
            id,
            process_id,
            status,
            ..
        } = item
        else {
            return true;
        };
        if let Some(scope) = self.commands.get(id) {
            if scope.turn_id != turn_id
                || scope.process_id != *process_id
                || (scope.completed && *status == CommandExecutionStatus::InProgress)
            {
                return false;
            }
        }
        self.commands.insert(
            id.clone(),
            CommandScope {
                turn_id: turn_id.to_string(),
                process_id: process_id.clone(),
                session_owned: session_command_is_running(item),
                completed: *status != CommandExecutionStatus::InProgress,
            },
        );
        true
    }

    pub(super) fn command_delta_allowed(&self, turn_id: &str, item_id: &str) -> bool {
        match self.commands.get(item_id) {
            Some(scope) => {
                scope.turn_id == turn_id
                    && !scope.completed
                    && (!self.closed_turn_ids.contains(turn_id) || scope.session_owned)
            }
            None => !self.closed_turn_ids.contains(turn_id),
        }
    }

    pub(super) fn settle_running_entries(&mut self, status: TurnStatus) {
        let entry_status = match status {
            TurnStatus::Completed => EntryStatus::Completed,
            TurnStatus::Failed => EntryStatus::Failed,
            TurnStatus::Interrupted => EntryStatus::Interrupted,
            TurnStatus::InProgress => return,
        };
        for entry in &mut self.entries {
            if self
                .commands
                .get(&entry.id)
                .is_some_and(|scope| scope.session_owned && !scope.completed)
            {
                continue;
            }
            if entry.status == Some(EntryStatus::Running) {
                entry.status = Some(entry_status);
            }
            // Canonical Turn completion settles provisional assistant/reasoning tails too.
            entry.streaming = false;
        }
    }
}
