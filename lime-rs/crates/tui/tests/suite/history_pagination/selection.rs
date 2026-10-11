//! Ordinary mouse selection retains its revision while real history pages are loaded.

use super::*;
use unicode_width::UnicodeWidthStr;

#[test]
fn transcript_selection_reaches_unloaded_history_without_clearing_the_selection() -> Result<()> {
    if std::env::var_os("LIME_TEST_TUI_HISTORY_PAGINATION").is_none() {
        return Ok(());
    }
    let fixture = ResumeFixture::from_env();
    let thread_id = required_path("LIME_TEST_TUI_HISTORY_THREAD_ID")
        .to_string_lossy()
        .into_owned();
    let turn_starts = || -> Result<usize> {
        Ok(std::fs::read_to_string(&fixture.ledger_path)?
            .lines()
            .filter_map(|line| serde_json::from_str::<Value>(line).ok())
            .filter(|entry| entry["kind"] == "turnStart")
            .count())
    };
    let starts = turn_starts()?;
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
    terminal.write_input(&[0x14])?;
    terminal.wait_for_screen_compact_contains("TRANSCRIPT", TRANSCRIPT_TIMEOUT)?;
    terminal.wait_for_screen_compact_contains("review complete", TRANSCRIPT_TIMEOUT)?;
    terminal.wait_for_screen_compact_contains("Home/End jump", TRANSCRIPT_TIMEOUT)?;
    let screen = terminal.screen_contents();
    ensure!(
        !screen.contains("SEED_000"),
        "oldest page was already visible:\n{screen}"
    );
    let (row, column) = screen
        .lines()
        .enumerate()
        .find_map(|(row, line)| {
            line.find("review complete")
                .map(|offset| (row + 1, line[..offset].width() + 1))
        })
        .context("canonical latest response must have mouse coordinates")?;
    terminal.write_input(
        format!(
            "\x1b[<0;{column};{row}M\x1b[<32;{};{row}M\x1b[<0;{};{row}m",
            column + 6,
            column + 6,
        )
        .as_bytes(),
    )?;
    wait_for_highlight(&mut terminal, true, "initial mouse gesture")?;

    let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
    while !terminal.screen_contains("SEED_000") {
        ensure!(
            std::time::Instant::now() < deadline,
            "ordinary frozen selection did not absorb canonical older pages:\n{}",
            terminal.screen_contents()
        );
        terminal.write_input(b"\x1b[5~")?;
        terminal.read_output(Duration::from_millis(20))?;
    }
    ensure!(
        !terminal.screen_contains("NESTED_REVIEW_PROMPT"),
        "hidden prompt entered the frozen selection:\n{}",
        terminal.screen_contents()
    );
    terminal.resize(12, 28)?;
    // The old wide-screen separator is outside the resized parser. Seeing it again proves a
    // real narrow frame before restoring width, rather than matching a retained body fragment.
    terminal.wait_for_screen_compact_contains("────", TRANSCRIPT_TIMEOUT)?;
    terminal.wait_for_screen_compact_contains("SEED_000", TRANSCRIPT_TIMEOUT)?;
    terminal.resize(32, 120)?;
    terminal.wait_for_screen_compact_contains("Home/End jump", TRANSCRIPT_TIMEOUT)?;
    terminal.write_input(b"\x1b[F")?;
    terminal.wait_for_screen_compact_contains("review complete", TRANSCRIPT_TIMEOUT)?;
    wait_for_highlight(&mut terminal, true, "history and resize restored")?;
    // The first Escape clears the retained selection; the pager stays open until Ctrl-T.
    terminal.write_input(b"\x1b")?;
    wait_for_highlight(&mut terminal, false, "selection cancelled")?;
    terminal.wait_for_screen_compact_contains("TRANSCRIPT", TRANSCRIPT_TIMEOUT)?;
    terminal.write_input(&[0x14])?;
    terminal.wait_for_screen_without("Up/Down scroll", TRANSCRIPT_TIMEOUT)?;
    exit_and_assert_terminal_restored(terminal, &thread_id)?;
    ensure!(
        turn_starts()? == starts,
        "selection history navigation started a turn"
    );
    println!("TUI_SELECTION_HISTORY_OK thread={thread_id} gesture=mouse pages=canonical oldest=SEED_000 latest=frozen resize=preserved cancel=selection-first turns=none terminal=restored");
    Ok(())
}

fn wait_for_highlight(terminal: &mut PtyLime, selected: bool, phase: &str) -> Result<()> {
    let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
    loop {
        let screen = terminal.screen_contents();
        let cell = screen.lines().enumerate().find_map(|(row, line)| {
            line.find("review complete")
                .map(|offset| (row as u16, line[..offset].width() as u16))
        });
        if cell.is_some_and(|(row, column)| terminal.screen_cell_inverse(row, column) == selected) {
            return Ok(());
        }
        ensure!(
            std::time::Instant::now() < deadline,
            "{phase}: selected={selected} was not visible on the canonical response:\n{screen}"
        );
        terminal.read_output(Duration::from_millis(20))?;
    }
}

#[test]
fn main_selection_reaches_unloaded_history_without_opening_the_transcript_overlay() -> Result<()> {
    if std::env::var_os("LIME_TEST_TUI_HISTORY_PAGINATION").is_none() {
        return Ok(());
    }
    let fixture = ResumeFixture::from_env();
    let thread_id = required_path("LIME_TEST_TUI_HISTORY_THREAD_ID")
        .to_string_lossy()
        .into_owned();
    let turn_starts = || -> Result<usize> {
        Ok(std::fs::read_to_string(&fixture.ledger_path)?
            .lines()
            .filter_map(|line| serde_json::from_str::<Value>(line).ok())
            .filter(|entry| entry["kind"] == "turnStart")
            .count())
    };
    let starts = turn_starts()?;
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
    terminal.wait_for_screen_compact_contains("review complete", TRANSCRIPT_TIMEOUT)?;
    terminal.write_input(b"\x1b[200~DRAFT_INTACT\x1b[201~")?;
    terminal.wait_for_screen_compact_contains("DRAFT_INTACT", TRANSCRIPT_TIMEOUT)?;
    let screen = terminal.screen_contents();
    ensure!(
        !screen.contains("SEED_000"),
        "oldest page was already visible:\n{screen}"
    );
    let (row, column) = screen
        .lines()
        .enumerate()
        .find_map(|(row, line)| {
            line.find("review complete")
                .map(|offset| (row + 1, line[..offset].width() + 1))
        })
        .context("main canonical response must have mouse coordinates")?;
    terminal.write_input(
        format!(
            "\x1b[<0;{column};{row}M\x1b[<32;{};{row}M\x1b[<0;{};{row}m",
            column + 6,
            column + 6,
        )
        .as_bytes(),
    )?;
    wait_for_highlight(&mut terminal, true, "main mouse selection")?;
    let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
    while !terminal.screen_contains("SEED_000") {
        ensure!(
            std::time::Instant::now() < deadline,
            "main selection did not load canonical older pages:\n{}",
            terminal.screen_contents()
        );
        terminal.write_input(b"\x1b[5~")?;
        terminal.read_output(Duration::from_millis(20))?;
    }
    let screen = terminal.screen_contents();
    ensure!(
        !screen.contains("TRANSCRIPT") && !screen.contains("NESTED_REVIEW_PROMPT"),
        "main selection opened another surface or retained a hidden prompt:\n{screen}"
    );
    terminal.resize(12, 28)?;
    terminal.wait_for_screen_compact_contains("SEED_000", TRANSCRIPT_TIMEOUT)?;
    terminal.resize(32, 120)?;
    terminal.wait_for_screen_compact_contains("DRAFT_INTACT", TRANSCRIPT_TIMEOUT)?;
    let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
    while !terminal.screen_contains("review complete") {
        ensure!(
            std::time::Instant::now() < deadline,
            "main selection lost its original response:\n{}",
            terminal.screen_contents()
        );
        terminal.write_input(b"\x1b[6~")?;
        terminal.read_output(Duration::from_millis(20))?;
    }
    wait_for_highlight(&mut terminal, true, "main selection after pages and resize")?;
    terminal.write_input(b"\x1b")?;
    wait_for_highlight(&mut terminal, false, "main selection cancelled")?;
    terminal.wait_for_screen_compact_contains("DRAFT_INTACT", TRANSCRIPT_TIMEOUT)?;
    terminal.write_input(&[0x15])?;
    terminal.wait_for_screen_without("DRAFT_INTACT", TRANSCRIPT_TIMEOUT)?;
    exit_and_assert_terminal_restored(terminal, &thread_id)?;
    ensure!(
        turn_starts()? == starts,
        "main selection history navigation started a turn"
    );
    println!("TUI_MAIN_SELECTION_HISTORY_OK thread={thread_id} gesture=mouse pages=canonical oldest=SEED_000 latest=frozen resize=preserved cancel=selection-only draft=preserved overlay=none turns=none terminal=restored");
    Ok(())
}
