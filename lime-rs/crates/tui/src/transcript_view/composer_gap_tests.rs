use super::*;
use ratatui::backend::TestBackend;
use ratatui::Terminal;

fn buffer_text(terminal: &Terminal<TestBackend>) -> String {
    let buffer = terminal.backend().buffer();
    (0..buffer.area.height)
        .map(|row| {
            (0..buffer.area.width)
                .map(|column| buffer[(column, row)].symbol())
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn copy_feedback_is_right_aligned_truthful_and_expires_without_sleep() {
    for (result, marker) in [
        (Ok(CopyStatus::Confirmed), "Copied 24 chars"),
        (Ok(CopyStatus::Unconfirmed), "Copy sent"),
        (Ok(CopyStatus::Pending(7)), "Copying selected text…"),
        (Ok(CopyStatus::Busy), "Copy already in progress"),
        (Err("offline".to_string()), "Copy failed"),
    ] {
        let gap = TranscriptComposerGap::default();
        gap.show_copy_feedback(&result, 24);
        let mut terminal = Terminal::new(TestBackend::new(40, 1)).expect("terminal");
        terminal
            .draw(|frame| {
                assert!(gap.render(frame, Some(frame.area()), Locale::EnUs));
            })
            .expect("draw");
        let rendered = buffer_text(&terminal);
        assert!(rendered.contains(marker), "{result:?}: {rendered}");
        assert!(rendered.ends_with(' '), "{result:?}: {rendered:?}");

        gap.expire_for_test();
        assert_eq!(gap.tick(Instant::now()), None);
        let mut owns_gap = true;
        terminal
            .draw(|frame| {
                owns_gap = gap.render(frame, Some(frame.area()), Locale::EnUs);
            })
            .expect("expired draw");
        assert!(!owns_gap);
    }
}

#[test]
fn progress_feedback_does_not_complete_the_original_ticket() {
    let gap = TranscriptComposerGap::default();
    gap.defer_copy(7, 24);
    for status in [CopyStatus::Pending(7), CopyStatus::Busy] {
        assert!(!gap.finish_copy(7, &Ok(status)), "{status:?}");
        assert_eq!(gap.pending_copy.get(), Some((7, 24)), "{status:?}");
        assert!(gap.feedback.get().is_none());
    }
    assert!(gap.finish_copy(7, &Ok(CopyStatus::Confirmed)));
    assert_eq!(gap.feedback.get().unwrap().characters, 24);
}

#[test]
fn pending_feedback_survives_expiry_but_not_view_reset_or_a_newer_request() {
    let gap = TranscriptComposerGap::default();
    gap.defer_copy(1, 24);
    gap.show_copy_feedback(&Ok(CopyStatus::Unconfirmed), 2);
    gap.expire_for_test();
    assert_eq!(gap.tick(Instant::now()), None);
    assert!(!gap.finish_copy(0, &Err("unrelated".into())));
    assert!(gap.finish_copy(1, &Ok(CopyStatus::Confirmed)));
    assert_eq!(gap.feedback.get().unwrap().characters, 24);
    assert_eq!(
        gap.feedback.get().unwrap().result,
        Ok(CopyStatus::Confirmed)
    );
    assert!(!gap.finish_copy(1, &Err("duplicate".into())));
    gap.defer_copy(2, 8);
    gap.clear();
    assert!(!gap.finish_copy(2, &Ok(CopyStatus::Confirmed)));
    assert!(gap.feedback.get().is_none());
    gap.defer_copy(3, 8);
    gap.defer_copy(4, 16);
    assert!(!gap.finish_copy(3, &Ok(CopyStatus::Confirmed)));
    assert!(gap.finish_copy(4, &Err("offline".into())));
    assert_eq!(gap.feedback.get().unwrap().characters, 16);
    assert_eq!(gap.feedback.get().unwrap().result, Err(()));
}
