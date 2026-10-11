//! Resize the actual tmux PTY while the foreground editor owns stdin.

use anyhow::{ensure, Result};

use super::{gate_enabled, row_containing, TmuxTerminal};

#[test]
fn external_editor_resize_returns_geometry_draft_and_first_key() -> Result<()> {
    if !gate_enabled() {
        return Ok(());
    }
    let terminal = TmuxTerminal::start("editor", true)?;
    terminal.send_text("tmux initial draft")?;
    terminal.wait_for_screen("draft before editor", |screen| {
        screen.contains("tmux initial draft")
    })?;
    terminal.send_keys(&["C-g"])?;
    terminal.wait_for_screen("foreground editor ready", |_| {
        terminal.cwd.join("editor-ready").exists()
    })?;
    ensure!(
        terminal.format("#{alternate_on}")? == "1",
        "editor handoff did not preserve alternate screen"
    );
    ensure!(
        terminal.screen()?.contains("tmux initial draft"),
        "editor handoff lost visible draft"
    );
    terminal.resize(16, 80)?;
    // Input belongs exclusively to the foreground editor until its exit. In
    // particular, the paused event reader must not steal this acknowledgement.
    terminal.send_text("tmux-editor-stdin-7391")?;
    // Send the same literal LF as the direct PTY editor fixture. tmux's Enter
    // key emits CR, which a shell read can retain when ICRNL is disabled.
    terminal.send_text("\n")?;
    let edited = "tmux edited draft 界🙂";
    let screen = terminal.wait_for_screen("edited draft after resize", |screen| {
        screen.contains(edited)
    })?;
    ensure!(
        row_containing(&screen, edited)? >= 10,
        "composer stayed at the old 32-row geometry:\n{screen}"
    );
    ensure!(
        terminal.format("#{alternate_on}")? == "1",
        "TUI did not re-enter alternate screen"
    );
    ensure!(
        std::fs::read_to_string(terminal.cwd.join("editor-input"))? == "tmux-editor-stdin-7391",
        "editor stdin was intercepted by the TUI reader"
    );
    // The first arrow after handoff must be parsed, rather than swallowed or
    // inserted as escape-sequence characters. Move across one Unicode grapheme.
    terminal.send_keys(&["Left"])?;
    terminal.send_text("!")?;
    let expected = "tmux edited draft 界!🙂";
    terminal.wait_for_screen("first key after editor", |screen| screen.contains(expected))?;
    terminal.resize(32, 120)?;
    terminal.wait_for_screen("monitor resumed after editor", |screen| {
        screen.contains(expected) && row_containing(screen, expected).is_ok_and(|row| row >= 26)
    })?;
    terminal.send_keys(&["Enter"])?;
    terminal.wait_for_screen("canonical turn completion", |screen| {
        screen.contains("TUI_GATE_B_COMPLETED")
    })?;
    let ledger = std::fs::read_to_string(terminal.cwd.join("ledger.jsonl"))?;
    let entries: Vec<serde_json::Value> = ledger
        .lines()
        .map(serde_json::from_str)
        .collect::<Result<_, _>>()?;
    let turns: Vec<_> = entries
        .iter()
        .filter(|entry| entry["kind"] == "turnStart")
        .collect();
    ensure!(
        turns.len() == 1,
        "expected one canonical turn, actual={}",
        turns.len()
    );
    let turn = turns[0];
    ensure!(
        turn["inputText"] == expected,
        "canonical editor input was changed: {}",
        turn["inputText"]
    );
    let thread_id = turn["threadId"]
        .as_str()
        .filter(|id| !id.is_empty())
        .expect("canonical thread id");
    let turn_id = turn["turnId"]
        .as_str()
        .filter(|id| !id.is_empty())
        .expect("canonical turn id");
    terminal.send_keys(&["C-d"])?;
    terminal.wait_for_exit()?;
    println!("TUI_TMUX_EDITOR_OK thread={thread_id} turn={turn_id} signal=blocked resize=during,after stdin=foreground draft=unicode first-key=preserved canonical=exact once=true terminal=restored");
    Ok(())
}
