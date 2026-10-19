use super::run_case;

#[tokio::test]
async fn completed_empty_message_without_deltas_has_an_explicit_lifecycle() {
    run_case(None, "", "completed").await;
}

#[tokio::test]
async fn completed_empty_snapshot_clears_partial_streamed_content() {
    run_case(Some("partial streamed text"), "", "completed").await;
}

#[tokio::test]
async fn completed_whitespace_snapshot_preserves_the_exact_body() {
    run_case(None, "  ", "completed").await;
}

#[tokio::test]
async fn completed_snapshot_survives_later_provider_failure() {
    run_case(Some("partial streamed text"), "completed answer", "failed").await;
}

#[tokio::test]
async fn completed_snapshot_survives_later_cancellation() {
    run_case(None, "completed answer", "interrupted").await;
}
