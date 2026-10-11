//! Real isolated tmux panes, including geometry changes with SIGWINCH blocked.

use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use anyhow::{bail, ensure, Context, Result};
use tempfile::TempDir;

use super::focus_palette::{required_test_path, PtyLime};

#[path = "external_editor_tests.rs"]
mod external_editor;

const TIMEOUT: Duration = Duration::from_secs(5);
const DRAFT: &str = "tmux resize draft sentinel";
const LAUNCHER: &str = "suite::tmux_resize::blocked_resize_signal_launcher";

#[test]
fn tmux_recovers_lost_resize_without_keyboard_input() -> Result<()> {
    if !gate_enabled() {
        return Ok(());
    }
    let terminal = TmuxTerminal::start("monitor", false)?;
    terminal.send_text(DRAFT)?;
    let baseline = terminal.wait_for_screen("initial draft", |screen| screen.contains(DRAFT))?;
    let baseline_row = row_containing(&baseline, DRAFT)?;
    for rows in [14, 20, 10, 32] {
        terminal.resize(rows, 120)?;
        terminal.wait_for_screen("lost resize recovery without input", |screen| {
            screen.contains(DRAFT)
                && row_containing(screen, DRAFT)
                    .is_ok_and(|row| row as isize == baseline_row as isize + rows as isize - 32)
        })?;
    }
    let width_tail = format!(" {} width-tail", "w".repeat(75));
    terminal.send_text(&width_tail)?;
    terminal.wait_for_screen("wide unwrapped draft", |screen| {
        row_containing(screen, DRAFT).ok() == row_containing(screen, "width-tail").ok()
            && screen.contains("width-tail")
    })?;
    terminal.resize(32, 60)?;
    terminal.wait_for_screen("width recovery without input", |screen| {
        row_containing(screen, "width-tail")
            .is_ok_and(|tail| row_containing(screen, DRAFT).is_ok_and(|draft| tail > draft))
    })?;
    terminal.resize(32, 120)?;
    terminal.wait_for_screen("restored composer anchor", |screen| {
        row_containing(screen, DRAFT).is_ok_and(|row| {
            row == baseline_row
                && row_containing(screen, "width-tail").is_ok_and(|tail| tail == row)
        })
    })?;
    terminal.send_keys(&["C-u"])?;
    terminal.wait_for_screen("cleared draft", |screen| {
        screen.contains("Ask Lime to do anything") && !screen.contains(DRAFT)
    })?;
    terminal.send_keys(&["C-d"])?;
    terminal.wait_for_exit()?;
    ensure!(
        !terminal.cwd.join("ledger.jsonl").exists(),
        "resize-only fixture unexpectedly submitted a turn"
    );
    println!("TUI_TMUX_RESIZE_OK signal=blocked input=none resize=height,width anchor=restored draft=preserved turns=none terminal=restored");
    Ok(())
}

// This entry point executes only in a pane on our private tmux server. Blocking the
// signal before spawn makes every CLI thread inherit the mask, without instrumentation.
#[test]
#[ignore = "tmux fixture launcher; invoked explicitly in an isolated pane"]
fn blocked_resize_signal_launcher() -> Result<()> {
    ensure!(
        gate_enabled(),
        "launcher requires the explicit tmux fixture"
    );
    let cwd = required_test_path("LIME_TEST_TMUX_CWD");
    ensure!(
        unsafe { libc::isatty(libc::STDIN_FILENO) } == 1,
        "pane stdin is not a PTY"
    );
    let before = terminal_modes()?;
    let mut signals = unsafe { std::mem::zeroed::<libc::sigset_t>() };
    // SAFETY: Both calls receive an initialized, live sigset; this isolated test
    // process owns the mask and no parent or user process is modified.
    unsafe {
        ensure!(libc::sigemptyset(&mut signals) == 0, "sigemptyset failed");
        ensure!(
            libc::sigaddset(&mut signals, libc::SIGWINCH) == 0,
            "sigaddset failed"
        );
        let result = libc::pthread_sigmask(libc::SIG_BLOCK, &signals, std::ptr::null_mut());
        ensure!(
            result == 0,
            "blocking SIGWINCH failed: {}",
            io::Error::from_raw_os_error(result)
        );
        ensure!(
            libc::pthread_sigmask(libc::SIG_SETMASK, std::ptr::null(), &mut signals) == 0,
            "querying signal mask failed"
        );
        ensure!(
            libc::sigismember(&signals, libc::SIGWINCH) == 1,
            "SIGWINCH is not blocked"
        );
    }
    std::fs::write(
        cwd.join("signal-blocked"),
        "SIGWINCH blocked before CLI spawn\n",
    )?;
    let configured = PtyLime::test_command(&cwd);
    let argv = configured.get_argv();
    let mut command = Command::new(&argv[0]);
    command.args(&argv[1..]).current_dir(&cwd);
    command.envs(configured.iter_extra_env_as_str());
    command.env_remove("VISUAL").env_remove("EDITOR");
    if std::env::var_os("LIME_TEST_TMUX_EDITOR").is_some() {
        command.env("VISUAL", shell_quote(&cwd.join("editor.sh"))?);
    }
    let status = command.status().context("running CLI in real tmux pane")?;
    ensure!(status.success(), "CLI exited with {status}");
    let after = terminal_modes()?;
    ensure!(
        before.c_iflag == after.c_iflag
            && before.c_oflag == after.c_oflag
            && before.c_cflag == after.c_cflag
            && before.c_lflag == after.c_lflag
            && before.c_cc == after.c_cc,
        "CLI did not restore the pane's original terminal modes"
    );
    std::fs::write(
        cwd.join("terminal-restored"),
        "tty modes restored; exit=0\n",
    )?;
    Ok(())
}

pub(super) fn gate_enabled() -> bool {
    std::env::var_os("LIME_TEST_TUI_GATE_B").is_some()
        && std::env::var_os("LIME_TEST_TMUX_BIN").is_some()
}

pub(super) struct TmuxTerminal {
    socket_directory: TempDir,
    socket: PathBuf,
    binary: PathBuf,
    pub(super) cwd: PathBuf,
}

impl TmuxTerminal {
    pub(super) fn start(case: &str, editor: bool) -> Result<Self> {
        let socket_directory = tempfile::Builder::new().prefix("tmux-").tempdir()?;
        let cwd = required_test_path("LIME_TEST_TERMINAL_CWD").join(case);
        std::fs::create_dir(&cwd)?;
        let terminal = Self {
            socket: socket_directory.path().join("socket"),
            socket_directory,
            binary: required_test_path("LIME_TEST_TMUX_BIN"),
            cwd,
        };
        if editor {
            use std::os::unix::fs::PermissionsExt;
            let script = terminal.cwd.join("editor.sh");
            std::fs::write(&script, "#!/bin/sh\nset -eu\ntest -t 0 && test -t 1 && test -t 2\n: > editor-ready\nIFS= read -r release\nprintf '%s' \"$release\" > editor-input\nprintf '%s' 'tmux edited draft 界🙂' > \"$1\"\nprintf '\\033[?1049l'\n")?;
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))?;
        }
        let mut launch = terminal.command();
        launch.env("LIME_TEST_TMUX_CWD", &terminal.cwd);
        if editor {
            launch.env("LIME_TEST_TMUX_EDITOR", "1");
        }
        let output = launch
            .args([
                "-f",
                "/dev/null",
                "new-session",
                "-d",
                "-s",
                "fixture",
                "-x",
                "120",
                "-y",
                "32",
                "/bin/sh",
            ])
            .output()?;
        ensure!(
            output.status.success(),
            "isolated tmux launch failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        terminal.run(&["set-option", "-g", "status", "off"])?;
        terminal.run(&["set-option", "-g", "remain-on-exit", "on"])?;
        terminal.run(&["set-option", "-g", "window-size", "manual"])?;
        let pipe = format!(
            "cat > {}",
            shell_quote(&terminal.cwd.join("pane-output.ansi"))?
        );
        terminal.run(&["pipe-pane", "-O", "-t", "fixture:0.0", &pipe])?;
        let entry = format!(
            "exec {} --exact {LAUNCHER} --ignored --nocapture",
            shell_quote(&std::env::current_exe()?)?
        );
        terminal.send_text(&entry)?;
        terminal.send_keys(&["Enter"])?;
        terminal.wait_for_screen("startup", |screen| {
            screen.contains("Ask Lime to do anything")
        })?;
        ensure!(
            terminal.cwd.join("signal-blocked").exists(),
            "launcher did not block SIGWINCH before CLI startup"
        );
        ensure!(
            terminal.format("#{alternate_on}")? == "1",
            "TUI did not enter alternate screen in tmux"
        );
        Ok(terminal)
    }

    fn command(&self) -> Command {
        let mut command = Command::new(&self.binary);
        command.arg("-S").arg(&self.socket);
        command.env_remove("TMUX").env_remove("TMUX_PANE");
        command
    }

    fn run(&self, args: &[&str]) -> Result<String> {
        let output = self.command().args(args).output()?;
        ensure!(
            output.status.success(),
            "tmux {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        Ok(String::from_utf8(output.stdout)?
            .trim_end_matches('\n')
            .to_string())
    }

    pub(super) fn format(&self, format: &str) -> Result<String> {
        self.run(&["display-message", "-p", "-t", "fixture:0.0", format])
    }

    pub(super) fn screen(&self) -> Result<String> {
        self.run(&["capture-pane", "-p", "-t", "fixture:0.0"])
    }

    pub(super) fn send_text(&self, text: &str) -> Result<()> {
        self.run(&["send-keys", "-l", "-t", "fixture:0.0", "--", text])?;
        Ok(())
    }

    pub(super) fn send_keys(&self, keys: &[&str]) -> Result<()> {
        let mut arguments = vec!["send-keys", "-t", "fixture:0.0"];
        arguments.extend_from_slice(keys);
        self.run(&arguments)?;
        Ok(())
    }

    pub(super) fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        self.run(&[
            "resize-window",
            "-t",
            "fixture:0",
            "-x",
            &cols.to_string(),
            "-y",
            &rows.to_string(),
        ])?;
        ensure!(
            self.format("#{pane_height},#{pane_width}")? == format!("{rows},{cols}"),
            "tmux pane did not adopt requested {rows}x{cols}"
        );
        Ok(())
    }

    pub(super) fn wait_for_screen(
        &self,
        phase: &str,
        predicate: impl Fn(&str) -> bool,
    ) -> Result<String> {
        let deadline = Instant::now()
            + if phase == "startup" {
                Duration::from_secs(30)
            } else {
                TIMEOUT
            };
        loop {
            let screen = self.screen()?;
            if predicate(&screen) {
                return Ok(screen);
            }
            if self.format("#{pane_dead}")? == "1" {
                // The child can publish its final file/output between the first
                // observation and the pane-dead query. Consume that final state.
                let final_screen = self.screen()?;
                if predicate(&final_screen) {
                    return Ok(final_screen);
                }
                bail!(
                    "tmux {phase} exited; cwd={}; screen:\n{final_screen}",
                    self.cwd.display()
                );
            }
            if Instant::now() >= deadline {
                bail!(
                    "tmux {phase} failed; cwd={}; screen:\n{screen}",
                    self.cwd.display()
                );
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    pub(super) fn wait_for_exit(&self) -> Result<()> {
        self.wait_for_screen("terminal exit", |_| {
            self.cwd.join("terminal-restored").exists()
        })?;
        ensure!(
            self.format("#{alternate_on}")? == "0",
            "tmux alternate screen was not restored"
        );
        let deadline = Instant::now() + TIMEOUT;
        loop {
            let raw = std::fs::read(self.cwd.join("pane-output.ansi"))?;
            if raw.windows(8).any(|bytes| bytes == b"\x1b[?1049l") {
                ensure!(
                    raw.windows(8).any(|bytes| bytes == b"\x1b[?1049h"),
                    "missing alternate screen entry"
                );
                return Ok(());
            }
            ensure!(
                Instant::now() < deadline,
                "tmux output pipe did not record terminal restoration"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}

impl Drop for TmuxTerminal {
    fn drop(&mut self) {
        // Every command targets the validated private socket, never a user server.
        let _ = self.command().arg("kill-server").status();
        let _ = &self.socket_directory;
    }
}

fn terminal_modes() -> Result<libc::termios> {
    let mut modes = std::mem::MaybeUninit::uninit();
    // SAFETY: tcgetattr initializes this live termios on success, checked before use.
    let result = unsafe { libc::tcgetattr(libc::STDIN_FILENO, modes.as_mut_ptr()) };
    ensure!(
        result == 0,
        "tcgetattr failed: {}",
        io::Error::last_os_error()
    );
    Ok(unsafe { modes.assume_init() })
}

fn shell_quote(path: &Path) -> Result<String> {
    let text = path
        .as_os_str()
        .to_str()
        .context("fixture path is not UTF-8")?;
    Ok(shlex::try_quote(text)?.into_owned())
}

pub(super) fn row_containing(screen: &str, text: &str) -> Result<usize> {
    screen
        .lines()
        .position(|line| line.contains(text))
        .with_context(|| format!("missing {text:?} in tmux screen:\n{screen}"))
}
