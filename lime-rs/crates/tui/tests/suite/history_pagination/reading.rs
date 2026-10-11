//! Gate a real App Server page response so the displayed group revision is observable.
//! The WebSocket relay forwards original stdio JSON-RPC bytes and supplies no server facts.

use super::*;
use std::collections::HashSet;
use std::io::Write;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Notify;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn main_reading_retains_a_page_join_revision_and_navigation_rejoins_current() -> Result<()> {
    if std::env::var_os("LIME_TEST_TUI_HISTORY_PAGINATION").is_none() {
        return Ok(());
    }
    let thread_id = required_path("LIME_TEST_TUI_READING_THREAD_ID")
        .to_string_lossy()
        .into_owned();
    for selection in [false, true] {
        let fixture = ResumeFixture::from_env();
        let starts = turn_starts(&fixture.ledger_path)?;
        let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
        let address = listener.local_addr()?;
        let seen = Arc::new(AtomicBool::new(false));
        let forwarded = Arc::new(AtomicBool::new(false));
        let release = Arc::new(Notify::new());
        let trace = fixture.cwd.join(format!("reading-relay-{selection}.jsonl"));
        let server = tokio::spawn(relay(
            listener,
            ResumeFixture::from_env(),
            seen.clone(),
            forwarded.clone(),
            release.clone(),
            trace.clone(),
        ));
        let mut terminal = PtyLime::start_remote_resume(
            &fixture.cli_bin,
            &format!("ws://{address}/rpc"),
            &fixture.cwd,
            &thread_id,
        )?;
        terminal.wait_for_startup_with_timeout(STARTUP_TIMEOUT)?;
        terminal
            .wait_for_screen_compact_contains("READING_SURVIVING_ROW_44", TRANSCRIPT_TIMEOUT)?;
        let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
        while !seen.load(Ordering::SeqCst) {
            ensure!(
                std::time::Instant::now() < deadline,
                "reader did not request the older canonical page:\n{}",
                terminal.screen_contents()
            );
            terminal.write_input(b"\x1b[<64;2;6M")?;
            terminal.read_output(Duration::from_millis(20))?;
        }
        position_at_group(&mut terminal)?;
        terminal.drain_output()?;
        ensure!(
            group_position(&terminal).is_some_and(|(row, _)| row == 0),
            "reading anchor moved before page acceptance:\n{}",
            terminal.screen_contents()
        );
        terminal.wait_for_screen_compact_contains("99 actions", TRANSCRIPT_TIMEOUT)?;
        ensure!(!terminal.screen_contains("120 actions"));
        if selection {
            let (row, column) = group_position(&terminal).context("visible computer group")?;
            terminal.write_input(
                format!(
                    "\x1b[<0;{};{}M\x1b[<32;{};{}M\x1b[<0;{};{}m",
                    column + 1,
                    row + 1,
                    column + 5,
                    row + 1,
                    column + 5,
                    row + 1
                )
                .as_bytes(),
            )?;
            wait_for_selection(&mut terminal, true)?;
        }
        release.notify_one();
        wait_for_atomic_flag(&mut terminal, &forwarded, TRANSCRIPT_TIMEOUT)?;
        terminal.drain_output()?;
        println!(
            "READING_PAGE_ACCEPTED selection={selection} screen:\n{}",
            terminal.screen_contents()
        );
        // Resize also forces a frame after the accepted page and its canonical Turn lookup.
        terminal.resize(12, 28)?;
        terminal
            .wait_for_screen_compact_contains("99 actions", TRANSCRIPT_TIMEOUT)
            .context("retained group after narrow resize")?;
        terminal.resize(32, 120)?;
        terminal.wait_for_screen_compact_contains("99 actions", TRANSCRIPT_TIMEOUT)?;
        if selection {
            wait_for_selection(&mut terminal, true)?;
        }
        ensure!(
            !terminal.screen_contains("120 actions"),
            "page acceptance replaced the retained group:\n{}",
            terminal.screen_contents()
        );
        if selection {
            terminal.write_input(b"\x1b")?;
            wait_for_selection(&mut terminal, false)?;
            terminal.wait_for_screen_compact_contains("99 actions", TRANSCRIPT_TIMEOUT)?;
        }
        terminal.write_input(b"\x1b[6~")?;
        terminal.wait_for_screen_without("99 actions", TRANSCRIPT_TIMEOUT)?;
        terminal.wait_for_screen_compact_contains("READING_SURVIVING_ROW_", TRANSCRIPT_TIMEOUT)?;
        terminal.write_input(b"\x1b[5~")?;
        terminal.wait_for_screen_compact_contains("120 actions", TRANSCRIPT_TIMEOUT)?;
        terminal.write_input(b"\x1b[1;3F")?;
        terminal
            .wait_for_screen_compact_contains("READING_SURVIVING_ROW_44", TRANSCRIPT_TIMEOUT)?;
        exit_and_assert_terminal_restored(terminal, &thread_id)?;
        tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .context("real App Server relay did not close")???;
        ensure!(
            turn_starts(&fixture.ledger_path)? == starts,
            "reading started a turn"
        );
        let messages = std::fs::read_to_string(trace)?
            .lines()
            .map(serde_json::from_str::<Value>)
            .collect::<std::result::Result<Vec<_>, _>>()?;
        ensure!(
            messages.iter().any(|message| {
                message["direction"] == "request"
                    && message["message"]["method"] == "thread/items/list"
                    && message["message"]["params"]["threadId"] == thread_id
                    && message["message"]["params"]["cursor"].is_string()
            }),
            "relay lacks the canonical older-page request"
        );
        ensure!(
            messages.iter().any(|message| {
                message["direction"] == "response"
                    && message["message"]["result"]["data"]
                        .as_array()
                        .is_some_and(|items| {
                            items.len() == 22
                                && items
                                    .iter()
                                    .any(|entry| entry["item"]["type"] == "userMessage")
                        })
            }),
            "relay lacks the unmodified older canonical page"
        );
    }
    println!("TUI_READING_HISTORY_OK thread={thread_id} transport=ws-relay-real-stdio initial=99 joined=120 reading=retained navigation=current selection=retained resize=preserved latest=restored turns=none terminal=restored");
    Ok(())
}

/// Position the reading anchor in the group, rather than the surviving session header above it.
fn position_at_group(terminal: &mut PtyLime) -> Result<()> {
    for attempt in 0..2 {
        let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
        let row = loop {
            if let Some((row, _)) = group_position(terminal).filter(|(row, _)| *row <= 2) {
                break row;
            }
            ensure!(
                std::time::Instant::now() < deadline,
                "group anchor was not reachable:\n{}",
                terminal.screen_contents()
            );
            terminal.write_input(b"\x1b[<64;2;6M")?;
            terminal.drain_output()?;
        };
        if row == 0 {
            return Ok(());
        }
        ensure!(
            attempt == 0,
            "group anchor is still below the reading position: {row}"
        );
        // Wheel movement uses three rows. Align that grid through real terminal geometry.
        let (rows, columns) = terminal.screen_size();
        terminal.resize(rows - row, columns)?;
        terminal.write_input(b"\x1b[1;3F")?;
        terminal
            .wait_for_screen_compact_contains("READING_SURVIVING_ROW_44", TRANSCRIPT_TIMEOUT)?;
    }
    unreachable!("position checked on the final attempt")
}

fn group_position(terminal: &PtyLime) -> Option<(u16, u16)> {
    use unicode_width::UnicodeWidthStr;
    terminal
        .screen_contents()
        .lines()
        .enumerate()
        .find_map(|(row, line)| {
            line.find("Used computer")
                .map(|column| (row as u16, line[..column].width() as u16))
        })
}

fn wait_for_selection(terminal: &mut PtyLime, selected: bool) -> Result<()> {
    let deadline = std::time::Instant::now() + TRANSCRIPT_TIMEOUT;
    loop {
        if group_position(terminal)
            .is_some_and(|(row, column)| terminal.screen_cell_inverse(row, column) == selected)
        {
            return Ok(());
        }
        ensure!(
            std::time::Instant::now() < deadline,
            "group selection={selected}:\n{}",
            terminal.screen_contents()
        );
        terminal.read_output(Duration::from_millis(20))?;
    }
}

pub(super) fn turn_starts(ledger: &std::path::Path) -> Result<usize> {
    Ok(std::fs::read_to_string(ledger)?
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|entry| entry["kind"] == "turnStart")
        .count())
}

async fn relay(
    listener: TcpListener,
    fixture: ResumeFixture,
    seen: Arc<AtomicBool>,
    forwarded: Arc<AtomicBool>,
    release: Arc<Notify>,
    trace: PathBuf,
) -> Result<()> {
    let mut command = Command::new(&fixture.app_server_bin);
    command
        .args(["--stdio", "--backend", "external", "--backend-command"])
        .arg(&fixture.node_bin)
        .arg("--backend-arg")
        .arg(&fixture.backend_path)
        .arg("--backend-arg")
        .arg(&fixture.ledger_path)
        .args(["--backend-timeout-ms", "5000", "--data-dir"])
        .arg(fixture.cwd.join("data"))
        .arg("--app-data-dir")
        .arg(fixture.cwd.join("app-data"))
        .current_dir(&fixture.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    if let Some(runtime_path) = std::env::var_os("LIME_TEST_DYLD_LIBRARY_PATH") {
        command.env("DYLD_LIBRARY_PATH", runtime_path);
    }
    let mut child = command.spawn()?;
    let mut stdin = child.stdin.take().context("App Server stdin")?;
    let mut lines = BufReader::new(child.stdout.take().context("App Server stdout")?).lines();
    let (stream, _) = listener.accept().await?;
    let mut socket = accept_async(stream).await?;
    let mut trace = std::fs::File::create(trace)?;
    let mut gated = HashSet::new();
    let mut item_pages = 0;
    let mut accepted_page = false;
    let mut turn_lookup = None;
    loop {
        tokio::select! {
            message = socket.next() => {
                let Some(message) = message else { break };
                match message? {
                    Message::Text(line) => {
                        let request: Value = serde_json::from_str(&line)?;
                        writeln!(trace, "{}", json!({"direction": "request", "message": request}))?;
                        if request["method"] == "thread/items/list" {
                            // Resume's initial page uses an inclusive cursor supplied by thread/resume.
                            if item_pages > 0 && request["params"]["cursor"].is_string() {
                                gated.insert(request["id"].to_string());
                            }
                            item_pages += 1;
                        }
                        if accepted_page && request["method"] == "thread/turns/list" {
                            turn_lookup = Some(request["id"].clone());
                        }
                        stdin.write_all(line.as_bytes()).await?;
                        stdin.write_all(b"\n").await?;
                        stdin.flush().await?;
                    }
                    Message::Close(_) => break,
                    Message::Ping(payload) => socket.send(Message::Pong(payload)).await?,
                    _ => {}
                }
            }
            line = lines.next_line() => {
                let Some(line) = line? else { break };
                let response: Value = serde_json::from_str(&line)?;
                let delay = gated.remove(&response["id"].to_string());
                if delay {
                    ensure!(response.get("error").is_none(), "real older-page error: {response}");
                    seen.store(true, Ordering::SeqCst);
                    release.notified().await;
                }
                writeln!(trace, "{}", json!({"direction": "response", "message": response}))?;
                socket.send(Message::Text(line)).await?;
                if delay { accepted_page = true; }
                if turn_lookup.as_ref().is_some_and(|id| *id == response["id"]) {
                    forwarded.store(true, Ordering::SeqCst);
                }
            }
        }
    }
    let _ = child.kill().await;
    Ok(())
}
