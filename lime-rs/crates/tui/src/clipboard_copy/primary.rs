//! Local X11 PRIMARY operations, owned by the session clipboard worker.

use super::CopyOutcome;
use std::time::Instant;

pub(crate) fn available() -> bool {
    cfg!(target_os = "linux")
        && std::env::var_os("DISPLAY").is_some()
        && std::env::var_os("WAYLAND_DISPLAY").is_none()
        && !super::is_ssh_session()
        && !super::is_tmux_session()
        && !super::is_wsl_session()
        && crate::clipboard_paste::detect_vscode_terminal()
            != crate::clipboard_paste::VscodeDetection::VsCode
}

pub(super) fn copy(
    text: &str,
    begin_delivery: impl FnOnce() -> Result<(), String>,
) -> Result<CopyOutcome, String> {
    if text.is_empty() {
        return Err("nothing to copy: the selected content is empty".into());
    }
    if !available() {
        return Err("X11 primary selection is unavailable in this terminal".into());
    }
    #[cfg(target_os = "linux")]
    {
        use arboard::SetExtLinux;
        let _guard = super::SuppressStderr::new();
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|error| format!("primary selection unavailable: {error}"))?;
        begin_delivery()?;
        clipboard
            .set()
            .clipboard(arboard::LinuxClipboardKind::Primary)
            .text(text)
            .map_err(|error| format!("failed to set X11 primary selection: {error}"))?;
        Ok(CopyOutcome::Copied(Some(
            super::ClipboardLease::native_linux(clipboard),
        )))
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = begin_delivery;
        Err("X11 primary selection is unavailable on this platform".into())
    }
}

pub(super) fn read(deadline: Instant) -> Result<String, String> {
    if !available() {
        return Err("X11 primary selection is unavailable in this terminal".into());
    }
    #[cfg(target_os = "linux")]
    {
        use arboard::GetExtLinux;
        crate::clipboard_paste::text::native_result(
            arboard::Clipboard::new().and_then(|mut clipboard| {
                clipboard
                    .get()
                    .clipboard(arboard::LinuxClipboardKind::Primary)
                    .text()
            }),
            deadline,
        )
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = deadline;
        Err("X11 primary selection is unavailable on this platform".into())
    }
}
