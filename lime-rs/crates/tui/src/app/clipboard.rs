//! Dispatch clipboard actions and apply asynchronous feedback to the selection owner.

use crate::app::{App, FullscreenSurface, TranscriptSelectionTarget};
use crate::clipboard_copy::worker::{Completion, CopyResult, PasteSource};
use crate::clipboard_copy::{CopyFormat, CopyStatus};
use crate::clipboard_paste::paste_image_to_temp_png;
use crate::transcript_view::CopyPosition;
use crate::tui::Tui;

#[derive(Debug)]
enum PendingCopyContext {
    LastResponse,
    Selection {
        label: String,
        format: CopyFormat,
    },
    ComposerSelection,
    TranscriptSelection {
        text: String,
        format: CopyFormat,
        follow: bool,
        target: TranscriptSelectionTarget,
    },
    ExportClipboard,
}

impl PendingCopyContext {
    fn format(&self) -> CopyFormat {
        match self {
            Self::LastResponse | Self::ExportClipboard => CopyFormat::Markdown,
            Self::ComposerSelection => CopyFormat::PlainText,
            Self::TranscriptSelection { format, .. } => format.clone(),
            Self::Selection { format, .. } => format.clone(),
        }
    }
    fn label(&self) -> &str {
        match self {
            Self::LastResponse => "last response",
            Self::ComposerSelection | Self::TranscriptSelection { .. } => "selected text",
            Self::ExportClipboard => "chat",
            Self::Selection { label, .. } => label,
        }
    }
}

#[derive(Debug)]
pub(super) struct PendingCopy {
    id: u64,
    thread_id: Option<String>,
    context: PendingCopyContext,
}

impl App {
    pub(crate) fn select_transcript_copy(&mut self) {
        if self.chat_widget.show_copy_picker() {
            self.finish_main_transcript_selection(false);
            return;
        }
        if !self.projection.entries().iter().any(|entry| {
            matches!(
                entry.kind,
                crate::projection::EntryKind::Assistant | crate::projection::EntryKind::User
            ) && !entry.text.trim().is_empty()
        }) {
            self.projection
                .set_status(self.chat_widget.locale.transcript_nothing_to_copy());
            return;
        }
        self.finish_main_transcript_selection(false);
        self.open_transcript_pager();
        if let Some(pager) = self.chat_widget.pager_overlay.as_ref() {
            pager.begin_copy_mode();
        }
    }

    pub(crate) fn finish_clipboard(&mut self, tui: &mut Tui) {
        self.validate_clipboard_paste();
        if !self.main_clipboard_surface_is_current() {
            self.transcript_view.selection.cancel_primary();
        }
        if self.fullscreen_surface() != Some(FullscreenSurface::Pager) {
            if let Some(pager) = self.chat_widget.pager_overlay.as_ref() {
                pager.cancel_primary();
            }
        }
        if self.fullscreen_surface() != Some(FullscreenSurface::ResumePicker) {
            if let Some(picker) = self.chat_widget.resume_picker.as_ref() {
                picker.cancel_primary();
            }
        }
        if let Some((id, completion)) = tui.clipboard.poll() {
            match completion {
                Completion::Read(result) => self.finish_clipboard_paste(id, result),
                Completion::Copy(completion) => self.finish_clipboard_copy(id, completion),
            }
        }
        tui.clipboard.advance(tui.frame_requester());
    }

    pub(crate) fn publish_primary_selection(
        &self,
        tui: &mut Tui,
        target: TranscriptSelectionTarget,
    ) {
        let frames = tui.frame_requester();
        match target {
            TranscriptSelectionTarget::MainTranscript => self
                .transcript_view
                .selection
                .publish_primary(&mut tui.clipboard, frames),
            TranscriptSelectionTarget::MainPager => {
                if let Some(pager) = self.chat_widget.pager_overlay.as_ref() {
                    pager.publish_primary(&mut tui.clipboard, frames);
                }
            }
            TranscriptSelectionTarget::ResumePicker => {
                if let Some(picker) = self.chat_widget.resume_picker.as_ref() {
                    picker.publish_primary(&mut tui.clipboard, frames);
                }
            }
        }
    }

    fn finish_clipboard_copy(&mut self, id: u64, completion: CopyResult) {
        if matches!(completion, Ok(CopyStatus::Pending(_) | CopyStatus::Busy)) {
            return;
        }
        if self
            .pending_clipboard_copy
            .as_ref()
            .is_none_or(|pending| pending.id != id)
        {
            return;
        }
        let pending = self
            .pending_clipboard_copy
            .take()
            .expect("matched clipboard completion");
        let same_thread = pending.thread_id == self.thread_id;
        self.apply_copy_completion(id, pending.context, completion, same_thread);
    }

    pub(crate) fn copy_last_response(&mut self, tui: &mut Tui) {
        if let Some(text) = self.last_response_to_copy() {
            self.queue_copy(tui, text, PendingCopyContext::LastResponse);
        }
    }

    fn last_response_to_copy(&mut self) -> Option<String> {
        let response = self.projection.final_answer();
        let response = crate::markdown_render::followup_labels(&response);
        if response.is_empty() {
            self.projection.set_status("no agent response to copy");
            None
        } else {
            Some(response.into_owned())
        }
    }

    pub(crate) fn copy_composer_selection(&mut self, tui: &mut Tui, text: String) {
        self.queue_copy(tui, text, PendingCopyContext::ComposerSelection);
    }

    pub(crate) fn copy_selection(
        &mut self,
        tui: &mut Tui,
        text: String,
        label: String,
        format: CopyFormat,
    ) {
        self.queue_copy(tui, text, PendingCopyContext::Selection { label, format });
    }

    pub(crate) fn copy_transcript_selection(
        &mut self,
        tui: &mut Tui,
        text: String,
        format: CopyFormat,
        follow: bool,
        target: TranscriptSelectionTarget,
    ) {
        self.queue_copy(
            tui,
            text.clone(),
            PendingCopyContext::TranscriptSelection {
                text,
                format,
                follow,
                target,
            },
        );
    }

    pub(crate) fn copy_export(&mut self, tui: &mut Tui, text: String) {
        self.queue_copy(tui, text, PendingCopyContext::ExportClipboard);
    }

    fn queue_copy(&mut self, tui: &mut Tui, text: String, context: PendingCopyContext) {
        match tui
            .clipboard
            .copy(text, context.format(), tui.frame_requester())
        {
            Ok(status) => {
                self.projection
                    .set_status(self.chat_widget.locale.copy_status(status, context.label()));
                if let CopyStatus::Pending(id) = status {
                    self.defer_copy(id, context);
                }
            }
            Err(error) => self.projection.set_status(format!("copy failed: {error}")),
        }
    }

    fn defer_copy(&mut self, id: u64, context: PendingCopyContext) {
        match &context {
            PendingCopyContext::ComposerSelection => {
                self.chat_widget.bottom_pane.defer_composer_copy(id);
            }
            PendingCopyContext::TranscriptSelection { text, target, .. } => {
                let characters = text.chars().count();
                match target {
                    TranscriptSelectionTarget::MainTranscript => {
                        self.transcript_view.selection.defer_copy(
                            id,
                            CopyPosition::DistanceFromBottom(self.transcript_view.scroll),
                        );
                        self.transcript_view.composer_gap.defer_copy(id, characters);
                    }
                    TranscriptSelectionTarget::MainPager => {
                        if let Some(pager) = self.chat_widget.pager_overlay.as_mut() {
                            pager.defer_transcript_copy(id, characters);
                        }
                    }
                    TranscriptSelectionTarget::ResumePicker => {
                        if let Some(picker) = self.chat_widget.resume_picker_mut() {
                            picker.defer_transcript_copy(id, characters);
                        }
                    }
                }
            }
            PendingCopyContext::LastResponse
            | PendingCopyContext::Selection { .. }
            | PendingCopyContext::ExportClipboard => {}
        }
        self.pending_clipboard_copy = Some(PendingCopy {
            id,
            thread_id: self.thread_id.clone(),
            context,
        });
    }

    pub(crate) fn paste_image(&mut self, tui: &Tui) {
        self.paste_image_with_reader(&tui.clipboard, paste_image_to_temp_png);
    }

    fn paste_image_with_reader(
        &mut self,
        clipboard: &crate::clipboard_copy::worker::ClipboardWorker,
        read: impl FnOnce() -> Result<
            (std::path::PathBuf, crate::clipboard_paste::PastedImageInfo),
            crate::clipboard_paste::PasteImageError,
        >,
    ) {
        if clipboard.is_busy() {
            self.projection
                .set_status(self.chat_widget.locale.status("clipboard is busy"));
            return;
        }
        let result = read();
        self.finish_image_paste(result, std::time::Instant::now());
    }

    fn finish_image_paste(
        &mut self,
        result: Result<
            (std::path::PathBuf, crate::clipboard_paste::PastedImageInfo),
            crate::clipboard_paste::PasteImageError,
        >,
        now: std::time::Instant,
    ) {
        match result {
            Ok((path, info)) => {
                self.attach_image(path);
                self.projection
                    .set_status(format!("image attached: {}x{}", info.width, info.height));
            }
            Err(error) => self
                .projection
                .set_status(format!("image paste failed: {error}")),
        }
        self.chat_widget.note_image_paste_finished(now);
    }

    pub(crate) fn paste_clipboard_text(&mut self, tui: &mut Tui, source: PasteSource) {
        match tui.clipboard.read_text(source, tui.frame_requester()) {
            Ok(Some((id, scope))) => {
                self.begin_clipboard_paste(id, source, scope);
            }
            Ok(None) => self
                .projection
                .set_status(self.chat_widget.locale.status("clipboard is busy")),
            Err(error) => self
                .projection
                .set_status(self.chat_widget.locale.clipboard_paste_failure(&error)),
        }
    }

    fn apply_copy_completion(
        &mut self,
        id: u64,
        context: PendingCopyContext,
        status: CopyResult,
        apply_feedback: bool,
    ) {
        if matches!(status, Ok(CopyStatus::Pending(_) | CopyStatus::Busy)) {
            return;
        }
        let feedback = match &context {
            PendingCopyContext::ComposerSelection => {
                let current = apply_feedback && self.composer_owns_clipboard();
                self.chat_widget
                    .bottom_pane
                    .finish_composer_copy(id, &status, current)
                    .map(|_| true)
            }
            PendingCopyContext::TranscriptSelection { follow, target, .. } => match target {
                TranscriptSelectionTarget::MainTranscript => {
                    let current = apply_feedback && self.main_clipboard_surface_is_current();
                    let selection_current = self.transcript_view.selection.finish_copy(
                        id,
                        current,
                        CopyPosition::DistanceFromBottom(self.transcript_view.scroll),
                    );
                    let feedback_completed = apply_feedback
                        && self.transcript_view.composer_gap.finish_copy(id, &status);
                    if selection_current
                        && matches!(status, Ok(crate::clipboard_copy::CopyStatus::Confirmed))
                    {
                        self.finish_main_transcript_selection(*follow);
                    }
                    (current && feedback_completed).then_some(selection_current)
                }
                TranscriptSelectionTarget::MainPager => {
                    if !apply_feedback {
                        return;
                    }
                    let current = self.fullscreen_surface() == Some(FullscreenSurface::Pager);
                    let copy_mode = self
                        .chat_widget
                        .pager_overlay
                        .as_ref()
                        .is_some_and(crate::pager_overlay::PagerOverlay::is_copy_mode);
                    let completed = self.chat_widget.pager_overlay.as_mut().and_then(|pager| {
                        pager.finish_transcript_copy(id, *follow, &status, current)
                    });
                    if copy_mode
                        && completed == Some(true)
                        && *follow
                        && matches!(status, Ok(CopyStatus::Confirmed))
                    {
                        self.chat_widget.dismiss_pager_overlay();
                    }
                    completed
                }
                TranscriptSelectionTarget::ResumePicker => {
                    if !apply_feedback {
                        return;
                    }
                    let current =
                        self.fullscreen_surface() == Some(FullscreenSurface::ResumePicker);
                    self.chat_widget.resume_picker_mut().and_then(|picker| {
                        picker.finish_transcript_copy(id, *follow, &status, current)
                    })
                }
            },
            _ => apply_feedback.then_some(false),
        };
        if feedback.is_none() {
            return;
        }
        let message = match status {
            Ok(CopyStatus::Confirmed) => match context {
                PendingCopyContext::LastResponse => "copied last response".into(),
                PendingCopyContext::ComposerSelection => "copy confirmed".into(),
                PendingCopyContext::TranscriptSelection { text, .. } => {
                    format!("copy confirmed: {}", text.chars().count())
                }
                PendingCopyContext::ExportClipboard => "exported conversation to clipboard".into(),
                PendingCopyContext::Selection { label, .. } => self
                    .chat_widget
                    .locale
                    .copy_status(CopyStatus::Confirmed, &label),
            },
            Ok(CopyStatus::Unconfirmed) => "copy unconfirmed".into(),
            Ok(CopyStatus::Pending(_) | CopyStatus::Busy) => return,
            Err(error) => {
                let prefix = if matches!(context, PendingCopyContext::ExportClipboard) {
                    "export failed"
                } else {
                    "copy failed"
                };
                format!("{prefix}: {error}")
            }
        };
        self.projection.set_status(message);
    }
}

#[cfg(test)]
#[path = "clipboard_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "image_paste_tests.rs"]
mod image_paste_tests;

#[cfg(test)]
#[path = "tests/copy_mode_tests.rs"]
mod copy_mode_tests;

#[cfg(test)]
#[path = "tests/copy_picker_tests.rs"]
mod copy_picker_tests;
#[cfg(test)]
#[path = "fullscreen_copy_tests.rs"]
mod fullscreen_copy_tests;
