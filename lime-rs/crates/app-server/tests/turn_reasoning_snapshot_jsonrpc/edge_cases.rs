use super::run_case;

#[tokio::test]
async fn opaque_only_completed_reasoning_has_an_empty_public_lifecycle() {
    run_case(false, &[], &[], "completed", false).await;
}

#[tokio::test]
async fn completed_empty_reasoning_clears_both_partial_arrays() {
    run_case(true, &[], &[], "completed", false).await;
}

#[tokio::test]
async fn completed_raw_content_can_clear_the_partial_summary() {
    run_case(true, &[], &["safe raw content"], "completed", false).await;
}

#[tokio::test]
async fn completed_summary_can_clear_the_partial_raw_content() {
    run_case(true, &["safe summary"], &[], "completed", false).await;
}

#[tokio::test]
async fn completed_reasoning_preserves_empty_and_whitespace_parts() {
    run_case(true, &["", "  "], &["\n", "完成🙂"], "completed", false).await;
}

#[tokio::test]
async fn completed_reasoning_survives_later_provider_failure() {
    run_case(true, &["safe summary"], &["safe content"], "failed", false).await;
}

#[tokio::test]
async fn completed_reasoning_survives_later_cancellation() {
    run_case(
        false,
        &["safe summary"],
        &["safe content"],
        "interrupted",
        false,
    )
    .await;
}

#[tokio::test]
async fn done_without_added_starts_and_completes_the_same_public_item() {
    run_case(
        false,
        &["safe summary"],
        &["safe content"],
        "completed",
        true,
    )
    .await;
}
