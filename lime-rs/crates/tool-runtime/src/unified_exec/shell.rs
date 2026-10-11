use super::unified_exec_error;
use crate::tool_executor::RuntimeToolExecutionError;
use std::path::{Path, PathBuf};

pub(super) fn build_shell_command(command: &str, shell: Option<&str>, login: bool) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        let shell = shell
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("powershell.exe");
        if shell.to_ascii_lowercase().contains("powershell")
            || shell.to_ascii_lowercase().contains("pwsh")
        {
            let mut shell_command = vec![shell.to_string()];
            if !login {
                shell_command.push("-NoProfile".to_string());
            }
            shell_command.extend([
                "-NonInteractive".to_string(),
                "-Command".to_string(),
                command.to_string(),
            ]);
            return shell_command;
        }
        return vec![
            shell.to_string(),
            "/D".to_string(),
            "/S".to_string(),
            "/C".to_string(),
            command.to_string(),
        ];
    }

    #[cfg(not(target_os = "windows"))]
    {
        let shell = shell
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .or_else(|| {
                std::env::var("SHELL")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
            })
            .unwrap_or_else(|| "sh".to_string());
        vec![
            shell,
            if login { "-lc" } else { "-c" }.to_string(),
            command.to_string(),
        ]
    }
}

pub(super) fn resolve_working_directory(
    turn_cwd: &Path,
    requested: Option<&str>,
    environment_id: &str,
) -> Result<PathBuf, RuntimeToolExecutionError> {
    let requested = requested.map(str::trim).filter(|value| !value.is_empty());
    let candidate = match requested {
        Some(value) if Path::new(value).is_absolute() => PathBuf::from(value),
        Some(value) => turn_cwd.join(value),
        None => turn_cwd.to_path_buf(),
    };
    if environment_id != "local" {
        if candidate.as_os_str().is_empty() {
            return Err(unified_exec_error(
                "exec_command remote workdir must not be empty".to_string(),
            ));
        }
        return Ok(candidate);
    }
    let canonical = std::fs::canonicalize(&candidate).map_err(|error| {
        unified_exec_error(format!(
            "exec_command workdir '{}' is unavailable: {error}",
            candidate.display()
        ))
    })?;
    if !canonical.is_dir() {
        return Err(unified_exec_error(format!(
            "exec_command workdir '{}' is not a directory",
            canonical.display()
        )));
    }
    Ok(canonical)
}
