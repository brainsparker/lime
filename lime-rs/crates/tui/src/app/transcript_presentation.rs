//! App-owned reading state and widget dialog presentation lifecycle.

use super::App;

impl App {
    pub(crate) fn open_transcript_pager(&mut self) {
        self.finish_main_transcript_selection(false);
        if let Some(scroll) = self.transcript_view.search.close() {
            self.transcript_view.scroll = scroll;
        }
        self.chat_widget.bottom_pane.clear_completion_popup();
        self.chat_widget.dismiss_pager_overlay();
        let pager = self.chat_widget.transcript_presentation.open(
            self.chat_widget.locale,
            self.chat_widget.runtime_keymap.transcript().clone(),
        );
        pager.set_older_history_available(self.chat_widget.scrollback_has_older_history);
        self.chat_widget.pager_overlay = Some(pager);
    }

    pub(super) fn dismiss_pager_overlay(&mut self) {
        self.reset_backtrack_state();
        self.chat_widget.dismiss_pager_overlay();
    }

    pub(super) fn reset_transcript_presentation(&mut self) {
        self.chat_widget.reset_transcript_presentation();
    }
}
