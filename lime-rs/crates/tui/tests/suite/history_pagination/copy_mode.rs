//! Copy navigation shares the real persisted multi-page thread used by history Gate B.

use super::*;

#[test]
fn transcript_copy_reaches_unloaded_history_and_preserves_the_latest_response() -> Result<()> {
    if std::env::var_os("LIME_TEST_TUI_HISTORY_PAGINATION").is_none() {
        return Ok(());
    }
    let fixture = ResumeFixture::from_env();
    let thread_id = required_path("LIME_TEST_TUI_HISTORY_THREAD_ID")
        .to_string_lossy()
        .into_owned();
    let starts = turn_starts(&fixture.ledger_path)?;
    let mut terminal = PtyLime::start_resume(
        &fixture.cli_bin,
        &fixture.app_server_bin,
        &fixture.backend_path,
        &fixture.ledger_path,
        &fixture.cwd,
        &fixture.node_bin,
        &thread_id,
    )?;
    terminal.wait_for_startup_with_timeout(STARTUP_TIMEOUT)?;
    terminal.write_input(b"\x1b[200~/copy\x1b[201~\r")?;
    terminal.wait_for_screen_compact_contains("Copy whole response", TRANSCRIPT_TIMEOUT)?;
    ensure!(
        !terminal.screen_contains("SEED_000"),
        "oldest page was already visible before copy requested history:\n{}",
        terminal.screen_contents()
    );
    terminal.write_input(b"g")?;
    terminal.wait_for_screen_compact_contains("Copy user message", TRANSCRIPT_TIMEOUT)?;
    // Revisit the beginning after the accepted pages extend the frozen snapshot. Poll real output
    // while exercising Home; no delay synthesizes history completion or clipboard delivery.
    let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
    while !terminal.screen_contains("SEED_000") {
        ensure!(
            std::time::Instant::now() < deadline,
            "copy did not reach unloaded canonical history:\n{}",
            terminal.screen_contents()
        );
        terminal.write_input(b"g")?;
        terminal.read_output(Duration::from_millis(20))?;
    }
    ensure!(
        !terminal.screen_contains("NESTED_REVIEW_PROMPT"),
        "hidden history entered copy targets:\n{}",
        terminal.screen_contents()
    );
    terminal.resize(12, 28)?;
    terminal.wait_for_screen_compact_contains("Copy user message", TRANSCRIPT_TIMEOUT)?;
    terminal.wait_for_screen_compact_contains("SEED_000", TRANSCRIPT_TIMEOUT)?;
    terminal.resize(32, 120)?;
    terminal.write_input(b"G")?;
    terminal.wait_for_screen_compact_contains("Copy whole response", TRANSCRIPT_TIMEOUT)?;
    terminal.wait_for_screen_compact_contains("review complete", TRANSCRIPT_TIMEOUT)?;
    terminal.write_input(b"\x1b")?;
    terminal.wait_for_screen_compact_contains("Ask Lime to do anything", TRANSCRIPT_TIMEOUT)?;
    exit_and_assert_terminal_restored(terminal, &thread_id)?;
    ensure!(
        turn_starts(&fixture.ledger_path)? == starts,
        "copy history navigation started an unintended turn"
    );
    println!("TUI_COPY_HISTORY_OK thread={thread_id} pages=canonical oldest=SEED_000 latest=frozen resize=preserved cancel=restored turns=none terminal=restored");
    Ok(())
}

fn turn_starts(ledger: &std::path::Path) -> Result<usize> {
    Ok(std::fs::read_to_string(ledger)?
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|entry| entry["kind"] == "turnStart")
        .count())
}
