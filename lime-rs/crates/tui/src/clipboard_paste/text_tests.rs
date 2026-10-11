use super::*;
use std::time::Duration;

#[test]
#[cfg(not(target_os = "android"))]
fn native_empty_clipboard_is_a_noop_but_native_failure_and_expiry_are_errors() {
    let deadline = Instant::now() + Duration::from_secs(1);
    assert_eq!(
        native_result(Err(arboard::Error::ContentNotAvailable), deadline),
        Ok(String::new())
    );
    assert_eq!(
        native_result(Err(arboard::Error::ClipboardNotSupported), deadline),
        Err("clipboard text is unavailable".into())
    );
    assert_eq!(
        native_result(Ok("late text".into()), Instant::now()),
        Err("clipboard read timed out".into())
    );
}

#[test]
#[cfg(not(target_os = "android"))]
fn native_text_uses_the_canonical_character_limit_instead_of_a_byte_limit() {
    let deadline = Instant::now() + Duration::from_secs(5);
    let text = "🙂".repeat(MAX_USER_INPUT_TEXT_CHARS);
    assert_eq!(native_result(Ok(text.clone()), deadline).unwrap(), text);
    assert_eq!(
        native_result(Ok(format!("{text}x")), deadline),
        Err("clipboard text exceeds the message size limit".into())
    );
}

#[cfg(unix)]
fn command(script: &str) -> tokio::process::Command {
    let mut command = tokio::process::Command::new("/bin/sh");
    command.args(["-c", script]);
    command
}

#[cfg(unix)]
#[tokio::test]
async fn host_reader_returns_utf8_and_empty_text_and_rejects_failure_and_invalid_encoding() {
    for (script, expected) in [
        ("printf '界🙂\\r\\ntext'", Ok("界🙂\r\ntext".into())),
        ("exit 0", Ok(String::new())),
        (
            "printf 'partial'; exit 1",
            Err("clipboard text is unavailable".into()),
        ),
        ("printf '\\377'", Err("clipboard text is not UTF-8".into())),
    ] {
        assert_eq!(
            read_command(command(script), Instant::now() + Duration::from_secs(1)).await,
            expected
        );
    }
}

#[cfg(unix)]
#[tokio::test]
async fn host_reader_limits_output_and_reaps_the_child_on_timeout() {
    assert_eq!(
        read_command(command("yes x"), Instant::now() + Duration::from_secs(2)).await,
        Err("clipboard text exceeds the message size limit".into())
    );
    let fixture = tempfile::tempdir().unwrap();
    let pid_path = fixture.path().join("reader.pid");
    let script = "printf '%s' \"$$\" > \"$1\"; while :; do :; done";
    let mut reader = tokio::process::Command::new("/bin/sh");
    reader.args(["-c", script, "reader"]).arg(&pid_path);
    assert_eq!(
        read_command(reader, Instant::now() + Duration::from_millis(200)).await,
        Err("clipboard read timed out".into())
    );
    let pid = std::fs::read_to_string(pid_path).unwrap();
    let status = std::process::Command::new("/bin/kill")
        .args(["-0", pid.trim()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .unwrap();
    assert!(!status.success(), "timed-out reader {pid} must be reaped");
}
