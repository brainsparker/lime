use base64::Engine;
use std::fmt;
use std::io::Write;

pub(crate) mod primary;
pub(crate) mod worker;

const OSC52_MAX_RAW_BYTES: usize = 100_000;

/// Whether the native clipboard also offers HTML for the original Markdown text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum CopyFormat {
    PlainText,
    Markdown,
    MarkdownSelection(std::sync::Arc<str>),
}

#[cfg(target_os = "macos")]
static STDERR_SUPPRESSION_MUTEX: std::sync::OnceLock<std::sync::Mutex<()>> =
    std::sync::OnceLock::new();

pub(crate) struct ClipboardLease {
    #[cfg(target_os = "linux")]
    _clipboard: Option<arboard::Clipboard>,
    #[cfg(test)]
    _test_owner: Option<std::sync::Arc<()>>,
}

/// A confirmed native clipboard write or an unacknowledged terminal request.
pub(crate) enum CopyOutcome {
    Copied(Option<ClipboardLease>),
    Requested,
}

impl CopyOutcome {
    /// Preserve an existing Linux clipboard owner unless a confirmed write replaces it.
    pub(crate) fn store(self, lease: &mut Option<ClipboardLease>) -> CopyStatus {
        match self {
            Self::Copied(next_lease) => {
                if let Some(next_lease) = next_lease {
                    *lease = Some(next_lease);
                }
                CopyStatus::Confirmed
            }
            Self::Requested => CopyStatus::Unconfirmed,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CopyStatus {
    Confirmed,
    Unconfirmed,
    Pending(u64),
    Busy,
}

impl CopyStatus {
    pub(crate) fn message(self, label: &str) -> String {
        match self {
            Self::Confirmed => format!("Copied {label} to clipboard"),
            Self::Unconfirmed => "Copy unconfirmed; /export saves chat".into(),
            Self::Pending(_) => format!("Copying {label}…"),
            Self::Busy => "Copy already in progress".into(),
        }
    }
}

impl fmt::Debug for ClipboardLease {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ClipboardLease")
    }
}

impl ClipboardLease {
    #[cfg(target_os = "linux")]
    fn native_linux(clipboard: arboard::Clipboard) -> Self {
        Self {
            _clipboard: Some(clipboard),
            #[cfg(test)]
            _test_owner: None,
        }
    }

    #[cfg(test)]
    pub(crate) fn test() -> Self {
        Self {
            #[cfg(target_os = "linux")]
            _clipboard: None,
            _test_owner: None,
        }
    }

    #[cfg(test)]
    pub(crate) fn test_with_owner(owner: std::sync::Arc<()>) -> Self {
        Self {
            #[cfg(target_os = "linux")]
            _clipboard: None,
            _test_owner: Some(owner),
        }
    }
}

#[derive(Clone, Copy)]
struct CopyEnvironment {
    ssh_session: bool,
    tmux_session: bool,
    wsl_session: bool,
}

fn copy_to_clipboard(
    text: &str,
    format: CopyFormat,
    begin_delivery: impl Fn() -> Result<(), String>,
    osc52: impl Fn(&str) -> Result<(), String>,
) -> Result<CopyOutcome, String> {
    #[cfg(not(target_os = "android"))]
    let native_copy = {
        let clipboard = open_clipboard();
        move |text: &str, html: Option<&str>| arboard_copy(clipboard, text, html)
    };
    #[cfg(target_os = "android")]
    let native_copy = |_text: &str, _html: Option<&str>| {
        Err("native clipboard unavailable on Android".to_string())
    };
    // Native initialization has finished; abandoned setup cannot start any write or fallback.
    begin_delivery()?;
    copy_to_clipboard_with(
        text,
        format,
        CopyEnvironment {
            ssh_session: is_ssh_session(),
            tmux_session: is_tmux_session(),
            wsl_session: is_wsl_session(),
        },
        tmux_clipboard_copy,
        osc52,
        native_copy,
        wsl_clipboard_copy,
    )
}

fn copy_to_clipboard_with(
    text: &str,
    format: CopyFormat,
    environment: CopyEnvironment,
    tmux_copy: impl Fn(&str) -> Result<(), String>,
    osc52_copy: impl Fn(&str) -> Result<(), String>,
    native_copy: impl FnOnce(&str, Option<&str>) -> Result<Option<ClipboardLease>, String>,
    wsl_copy: impl Fn(&str) -> Result<(), String>,
) -> Result<CopyOutcome, String> {
    if text.is_empty() {
        return Err("nothing to copy: the selected content is empty".to_string());
    }

    let terminal_copy = || terminal_copy(text, environment.tmux_session, &tmux_copy, &osc52_copy);
    let html = match format {
        CopyFormat::PlainText => None,
        CopyFormat::Markdown => Some(crate::clipboard_html::render_markdown(text)),
        CopyFormat::MarkdownSelection(markdown) => {
            Some(crate::clipboard_html::render_markdown(&markdown))
        }
    };
    let native_result = native_copy(text, html.as_deref()).or_else(|native_error| {
        if environment.wsl_session {
            wsl_copy(text).map(|()| None).map_err(|wsl_error| {
                format!("native clipboard: {native_error}; WSL fallback: {wsl_error}")
            })
        } else {
            Err(format!("native clipboard: {native_error}"))
        }
    });
    // Terminal writes have no delivery acknowledgement, so they never suppress a native attempt.
    // tmux forwarding also runs for local sessions because future attached clients need the copy.
    let terminal_result = (environment.tmux_session || environment.ssh_session).then(terminal_copy);
    match native_result {
        Ok(lease) => Ok(CopyOutcome::Copied(lease)),
        Err(native_error) => terminal_result
            .unwrap_or_else(terminal_copy)
            .map(|()| CopyOutcome::Requested)
            .map_err(|terminal_error| {
                format!("{native_error}; terminal clipboard: {terminal_error}")
            }),
    }
}

fn terminal_copy(
    text: &str,
    tmux_session: bool,
    tmux_copy: &impl Fn(&str) -> Result<(), String>,
    osc52_copy: &impl Fn(&str) -> Result<(), String>,
) -> Result<(), String> {
    if tmux_session {
        return tmux_copy(text).or_else(|tmux_error| {
            osc52_copy(text).map_err(|osc52_error| {
                format!("tmux clipboard: {tmux_error}; OSC 52 fallback: {osc52_error}")
            })
        });
    }
    osc52_copy(text)
}

pub(crate) fn is_ssh_session() -> bool {
    std::env::var_os("SSH_TTY").is_some() || std::env::var_os("SSH_CONNECTION").is_some()
}

pub(crate) fn is_tmux_session() -> bool {
    std::env::var_os("TMUX").is_some() || std::env::var_os("TMUX_PANE").is_some()
}

#[cfg(target_os = "linux")]
pub(crate) fn is_wsl_session() -> bool {
    std::env::var_os("WSL_DISTRO_NAME").is_some()
        || std::fs::read_to_string("/proc/sys/kernel/osrelease")
            .is_ok_and(|release| release.to_ascii_lowercase().contains("microsoft"))
}

#[cfg(not(target_os = "linux"))]
pub(crate) fn is_wsl_session() -> bool {
    false
}

#[cfg(not(target_os = "android"))]
fn open_clipboard() -> Result<arboard::Clipboard, String> {
    #[cfg(target_os = "macos")]
    let _stderr_lock = STDERR_SUPPRESSION_MUTEX
        .get_or_init(|| std::sync::Mutex::new(()))
        .lock()
        .map_err(|_| "stderr suppression lock poisoned".to_string())?;
    let _guard = SuppressStderr::new();
    arboard::Clipboard::new().map_err(|error| format!("clipboard unavailable: {error}"))
}

#[cfg(not(target_os = "android"))]
fn arboard_copy(
    clipboard: Result<arboard::Clipboard, String>,
    text: &str,
    html: Option<&str>,
) -> Result<Option<ClipboardLease>, String> {
    #[cfg(target_os = "macos")]
    let _stderr_lock = STDERR_SUPPRESSION_MUTEX
        .get_or_init(|| std::sync::Mutex::new(()))
        .lock()
        .map_err(|_| "stderr suppression lock poisoned".to_string())?;
    let _guard = SuppressStderr::new();
    let mut clipboard = clipboard?;
    match html {
        Some(html) => clipboard
            .set_html(html, Some(text))
            .or_else(|_| clipboard.set_text(text)),
        None => clipboard.set_text(text),
    }
    .map_err(|error| format!("failed to set clipboard text: {error}"))?;
    #[cfg(target_os = "linux")]
    return Ok(Some(ClipboardLease::native_linux(clipboard)));
    #[cfg(not(target_os = "linux"))]
    Ok(None)
}

#[cfg(target_os = "linux")]
fn wsl_clipboard_copy(text: &str) -> Result<(), String> {
    let mut child = std::process::Command::new("powershell.exe")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .args([
            "-NoProfile",
            "-Command",
            "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; $ErrorActionPreference = 'Stop'; $text = [Console]::In.ReadToEnd(); Set-Clipboard -Value $text",
        ])
        .spawn()
        .map_err(|error| format!("failed to spawn powershell.exe: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "failed to open powershell.exe stdin".to_string())?;
    stdin
        .write_all(text.as_bytes())
        .map_err(|error| format!("failed to write to powershell.exe: {error}"))?;
    drop(stdin);
    let output = child
        .wait_with_output()
        .map_err(|error| format!("failed to wait for powershell.exe: {error}"))?;
    output.status.success().then_some(()).ok_or_else(|| {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            format!("powershell.exe exited with status {}", output.status)
        } else {
            format!("powershell.exe failed: {stderr}")
        }
    })
}

#[cfg(not(target_os = "linux"))]
fn wsl_clipboard_copy(_text: &str) -> Result<(), String> {
    Err("WSL clipboard fallback unavailable on this platform".to_string())
}

fn tmux_clipboard_copy(text: &str) -> Result<(), String> {
    tmux_clipboard_copy_ready(
        || tmux_command_output(["show-options", "-gv", "set-clipboard"]),
        || tmux_command_output(["info"]),
    )?;
    let mut child = std::process::Command::new("tmux")
        .args(["load-buffer", "-w", "-"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to spawn tmux: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "failed to open tmux stdin".to_string())?;
    stdin
        .write_all(text.as_bytes())
        .map_err(|error| format!("failed to write to tmux: {error}"))?;
    drop(stdin);
    let output = child
        .wait_with_output()
        .map_err(|error| format!("failed to wait for tmux: {error}"))?;
    output.status.success().then_some(()).ok_or_else(|| {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            format!("tmux exited with status {}", output.status)
        } else {
            format!("tmux failed: {stderr}")
        }
    })
}

fn tmux_clipboard_copy_ready(
    set_clipboard: impl FnOnce() -> Result<String, String>,
    terminal_info: impl FnOnce() -> Result<String, String>,
) -> Result<(), String> {
    if set_clipboard()?.trim() == "off" {
        return Err("tmux clipboard forwarding is disabled".to_string());
    }
    if terminal_info()?
        .lines()
        .any(|line| line.contains("Ms: [missing]"))
    {
        return Err("tmux clipboard forwarding is unavailable: missing Ms capability".to_string());
    }
    Ok(())
}

fn tmux_command_output<const N: usize>(args: [&str; N]) -> Result<String, String> {
    let output = std::process::Command::new("tmux")
        .args(args)
        .output()
        .map_err(|error| format!("failed to spawn tmux: {error}"))?;
    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|error| format!("tmux output was not UTF-8: {error}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(format!("tmux exited with status {}", output.status))
        } else {
            Err(format!("tmux failed: {stderr}"))
        }
    }
}

fn osc52_copy(text: &str) -> Result<(), String> {
    let sequence = osc52_sequence(text, is_tmux_session())?;
    #[cfg(unix)]
    if let Ok(tty) = std::fs::OpenOptions::new().write(true).open("/dev/tty") {
        if write_osc52(tty, &sequence).is_ok() {
            return Ok(());
        }
    }
    write_osc52(std::io::stdout().lock(), &sequence)
}

fn write_osc52(mut writer: impl Write, sequence: &str) -> Result<(), String> {
    writer
        .write_all(sequence.as_bytes())
        .map_err(|error| format!("failed to write OSC 52: {error}"))?;
    writer
        .flush()
        .map_err(|error| format!("failed to flush OSC 52: {error}"))
}

fn osc52_sequence(text: &str, tmux: bool) -> Result<String, String> {
    if text.len() > OSC52_MAX_RAW_BYTES {
        return Err(format!(
            "OSC 52 payload too large ({} bytes; max {OSC52_MAX_RAW_BYTES})",
            text.len()
        ));
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(text.as_bytes());
    if tmux {
        Ok(format!("\x1bPtmux;\x1b\x1b]52;c;{encoded}\x07\x1b\\"))
    } else {
        Ok(format!("\x1b]52;c;{encoded}\x07"))
    }
}

#[cfg(target_os = "macos")]
struct SuppressStderr {
    saved_fd: Option<libc::c_int>,
}

#[cfg(target_os = "macos")]
impl SuppressStderr {
    fn new() -> Self {
        unsafe {
            let saved = libc::dup(2);
            if saved < 0 {
                return Self { saved_fd: None };
            }
            let devnull = libc::open(c"/dev/null".as_ptr(), libc::O_WRONLY);
            if devnull < 0 || libc::dup2(devnull, 2) < 0 {
                libc::close(saved);
                if devnull >= 0 {
                    libc::close(devnull);
                }
                return Self { saved_fd: None };
            }
            libc::close(devnull);
            Self {
                saved_fd: Some(saved),
            }
        }
    }
}

#[cfg(target_os = "macos")]
impl Drop for SuppressStderr {
    fn drop(&mut self) {
        if let Some(saved) = self.saved_fd {
            unsafe {
                libc::dup2(saved, 2);
                libc::close(saved);
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
struct SuppressStderr;

#[cfg(not(target_os = "macos"))]
impl SuppressStderr {
    fn new() -> Self {
        Self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn native_markdown_offer_retains_original_text_and_plaintext_has_no_html() {
        for (text, format, expected) in [
            ("**hello**", CopyFormat::PlainText, None),
            (
                "**hello**",
                CopyFormat::Markdown,
                Some("<p><strong>hello</strong></p>\n"),
            ),
            (
                "hello",
                CopyFormat::MarkdownSelection("**hello**".into()),
                Some("<p><strong>hello</strong></p>\n"),
            ),
        ] {
            let called = Cell::new(false);
            let result = copy_to_clipboard_with(
                text,
                format,
                CopyEnvironment {
                    ssh_session: false,
                    tmux_session: false,
                    wsl_session: false,
                },
                |_| panic!("local native success cannot forward to tmux"),
                |_| panic!("local native success cannot forward to terminal"),
                |literal, html| {
                    assert_eq!(literal, text);
                    assert_eq!(html, expected);
                    called.set(true);
                    Ok(None)
                },
                |_| panic!("native success cannot fall back to WSL"),
            );
            assert!(matches!(result, Ok(CopyOutcome::Copied(None))));
            assert!(called.get());
        }
    }

    #[test]
    fn markdown_fallbacks_receive_original_text_and_preserve_delivery_truth() {
        for target in ["wsl", "tmux", "terminal"] {
            let calls = std::cell::RefCell::new(Vec::new());
            let record = |backend, text: &str| {
                calls.borrow_mut().push((backend, text.to_owned()));
                Ok(())
            };
            let result = copy_to_clipboard_with(
                "**hello**",
                CopyFormat::Markdown,
                CopyEnvironment {
                    ssh_session: false,
                    tmux_session: target == "tmux",
                    wsl_session: target == "wsl",
                },
                |text| record("tmux", text),
                |text| record("terminal", text),
                |text, html| {
                    assert_eq!(text, "**hello**");
                    assert_eq!(html, Some("<p><strong>hello</strong></p>\n"));
                    Err("native unavailable".into())
                },
                |text| record("wsl", text),
            );
            let mut lease = Some(ClipboardLease::test());
            assert_eq!(
                result.unwrap().store(&mut lease),
                if target == "wsl" {
                    CopyStatus::Confirmed
                } else {
                    CopyStatus::Unconfirmed
                }
            );
            assert!(lease.is_some());
            assert_eq!(*calls.borrow(), vec![(target, "**hello**".into())]);
        }
    }

    #[test]
    fn osc52_encoding_roundtrips_and_wraps_tmux() {
        let text = "# Result\n\n```rust\nfn main() {}\n```";
        let sequence = osc52_sequence(text, false).expect("OSC 52 sequence");
        let encoded = sequence
            .trim_start_matches("\u{1b}]52;c;")
            .trim_end_matches('\u{7}');
        assert_eq!(
            base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .expect("base64"),
            text.as_bytes()
        );
        assert_eq!(
            osc52_sequence("hello", true),
            Ok("\u{1b}Ptmux;\u{1b}\u{1b}]52;c;aGVsbG8=\u{7}\u{1b}\\".to_string())
        );
    }

    #[test]
    fn osc52_rejects_oversized_payloads() {
        let text = "x".repeat(OSC52_MAX_RAW_BYTES + 1);
        assert!(osc52_sequence(&text, false).is_err());
    }

    #[test]
    fn primary_selection_rejects_empty_text_before_platform_probe() {
        match primary::copy("", || panic!("empty selection cannot start delivery")) {
            Err(error) => assert_eq!(error, "nothing to copy: the selected content is empty"),
            Ok(_) => panic!("empty selection must fail"),
        }
    }

    #[test]
    fn ssh_attempts_native_and_terminal_while_local_prefers_native() {
        let native_calls = Cell::new(0);
        let osc_calls = Cell::new(0);
        let remote = copy_to_clipboard_with(
            "remote",
            CopyFormat::PlainText,
            CopyEnvironment {
                ssh_session: true,
                tmux_session: false,
                wsl_session: false,
            },
            |_| Ok(()),
            |_| {
                osc_calls.set(osc_calls.get() + 1);
                Ok(())
            },
            |_, _| {
                native_calls.set(native_calls.get() + 1);
                Ok(None)
            },
            |_| Ok(()),
        );
        assert!(matches!(remote, Ok(CopyOutcome::Copied(None))));
        assert_eq!(osc_calls.get(), 1);
        assert_eq!(native_calls.get(), 1);

        let local = copy_to_clipboard_with(
            "local",
            CopyFormat::PlainText,
            CopyEnvironment {
                ssh_session: false,
                tmux_session: false,
                wsl_session: false,
            },
            |_| Ok(()),
            |_| panic!("OSC 52 should not run"),
            |_, _| Ok(Some(ClipboardLease::test())),
            |_| Ok(()),
        );
        assert!(matches!(local, Ok(CopyOutcome::Copied(Some(_)))));
    }

    #[test]
    fn tmux_and_local_failures_fall_back_to_osc52() {
        let osc_calls = Cell::new(0);
        let result = copy_to_clipboard_with(
            "hello",
            CopyFormat::PlainText,
            CopyEnvironment {
                ssh_session: false,
                tmux_session: true,
                wsl_session: false,
            },
            |_| Err("tmux unavailable".to_string()),
            |_| {
                osc_calls.set(osc_calls.get() + 1);
                Ok(())
            },
            |_, _| Err("native unavailable".to_string()),
            |_| Ok(()),
        );
        assert!(matches!(result, Ok(CopyOutcome::Requested)));
        assert_eq!(osc_calls.get(), 1);
    }

    #[test]
    fn terminal_only_copy_is_unconfirmed_and_preserves_native_lease() {
        let outcome = copy_to_clipboard_with(
            "hello",
            CopyFormat::PlainText,
            CopyEnvironment {
                ssh_session: true,
                tmux_session: false,
                wsl_session: false,
            },
            |_| Ok(()),
            |_| Ok(()),
            |_, _| Err("native unavailable".to_string()),
            |_| Ok(()),
        )
        .expect("terminal request");
        let mut lease = Some(ClipboardLease::test());

        assert_eq!(outcome.store(&mut lease), CopyStatus::Unconfirmed);
        assert!(lease.is_some());
    }

    #[test]
    fn wsl_copy_is_confirmed_and_native_success_wins_over_terminal_failure() {
        let wsl = copy_to_clipboard_with(
            "wsl",
            CopyFormat::PlainText,
            CopyEnvironment {
                ssh_session: false,
                tmux_session: false,
                wsl_session: true,
            },
            |_| Ok(()),
            |_| panic!("terminal fallback should not run"),
            |_, _| Err("native unavailable".to_string()),
            |_| Ok(()),
        )
        .expect("WSL clipboard write");
        let mut lease = None;
        assert_eq!(wsl.store(&mut lease), CopyStatus::Confirmed);

        let native = copy_to_clipboard_with(
            "native",
            CopyFormat::PlainText,
            CopyEnvironment {
                ssh_session: true,
                tmux_session: false,
                wsl_session: false,
            },
            |_| Ok(()),
            |_| Err("terminal blocked".to_string()),
            |_, _| Ok(Some(ClipboardLease::test())),
            |_| Ok(()),
        )
        .expect("native clipboard write");
        assert_eq!(native.store(&mut lease), CopyStatus::Confirmed);
        assert!(lease.is_some());
    }

    #[test]
    fn tmux_requires_clipboard_forwarding_capability() {
        assert!(tmux_clipboard_copy_ready(
            || Ok("external\n".to_string()),
            || Ok("193: Ms: (string) \\033]52\n".to_string()),
        )
        .is_ok());
        assert_eq!(
            tmux_clipboard_copy_ready(
                || Ok("off\n".to_string()),
                || panic!("terminal info should not be queried"),
            ),
            Err("tmux clipboard forwarding is disabled".to_string())
        );
        assert_eq!(
            tmux_clipboard_copy_ready(
                || Ok("external\n".to_string()),
                || Ok("193: Ms: [missing]\n".to_string()),
            ),
            Err("tmux clipboard forwarding is unavailable: missing Ms capability".to_string())
        );
    }
}
