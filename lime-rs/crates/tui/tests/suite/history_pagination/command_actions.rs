//! The server parses canonical scripts; this PTY only consumes the public projection.

use super::*;

#[test]
fn restored_commands_render_shared_exploration_actions_in_the_real_tui() -> Result<()> {
    if std::env::var_os("LIME_TEST_TUI_HISTORY_PAGINATION").is_none() {
        return Ok(());
    }
    let fixture = ResumeFixture::from_env();
    let thread_id = required_path("LIME_TEST_TUI_COMMAND_THREAD_ID")
        .to_string_lossy()
        .into_owned();
    let starts = reading::turn_starts(&fixture.ledger_path)?;
    let mut terminal = PtyLime::start_resume(
        &fixture.cli_bin,
        &fixture.app_server_bin,
        &fixture.backend_path,
        &fixture.ledger_path,
        &fixture.cwd,
        &fixture.node_bin,
        &thread_id,
    )?;
    terminal.resize(50, 120)?;
    terminal.wait_for_startup_with_timeout(STARTUP_TIMEOUT)?;
    for text in [
        "COMMAND_ACTIONS_DONE",
        "Read guide one.md, README.md",
        "Search COMMAND_QUERY",
        "List lib",
        "cat README.md && cargo test",
        "cat USER_SHELL.md",
    ] {
        terminal.wait_for_screen_compact_contains(text, TRANSCRIPT_TIMEOUT)?;
    }
    let screen = terminal.screen_contents();
    ensure!(
        screen.matches("Explored").count() == 2,
        "unexpected exploration grouping:\n{screen}"
    );
    ensure!(
        !screen.contains("Read USER_SHELL.md"),
        "user shell became an exploration group:\n{screen}"
    );
    terminal.resize(50, 55)?;
    terminal.wait_for_screen_compact_contains("COMMAND_ACTIONS_DONE", TRANSCRIPT_TIMEOUT)?;
    terminal.resize(50, 120)?;
    terminal
        .wait_for_screen_compact_contains("Read guide one.md, README.md", TRANSCRIPT_TIMEOUT)?;
    terminal.write_input(b"\x1b[<64;2;6M")?;
    terminal.read_output(Duration::from_millis(50))?;
    terminal.write_input(b"\x1b[1;3F")?;
    terminal.wait_for_screen_compact_contains("COMMAND_ACTIONS_DONE", TRANSCRIPT_TIMEOUT)?;
    exit_and_assert_terminal_restored(terminal, &thread_id)?;
    ensure!(
        reading::turn_starts(&fixture.ledger_path)? == starts,
        "command reading created a turn"
    );
    println!("TUI_COMMAND_ACTIONS_OK thread={thread_id} transport=real-stdio read=grouped search=listFiles unknown=opaque userShell=separate resize=preserved turns=none terminal=restored");
    Ok(())
}
