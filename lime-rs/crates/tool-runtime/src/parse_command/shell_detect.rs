// Adapted from OpenAI Codex shell-command at
// 4aaee872e31abefe0d32e91faab23b09b6968824 (Apache-2.0).
// See LICENSE and NOTICE.

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ShellType {
    Zsh,
    Bash,
    PowerShell,
    Sh,
    Cmd,
}

pub fn detect_shell_type(shell_path: impl AsRef<std::path::Path>) -> Option<ShellType> {
    let shell_path = shell_path.as_ref();
    match shell_path.as_os_str().to_str() {
        Some("zsh") => Some(ShellType::Zsh),
        Some("sh") => Some(ShellType::Sh),
        Some("cmd") => Some(ShellType::Cmd),
        Some("bash") => Some(ShellType::Bash),
        Some("pwsh") => Some(ShellType::PowerShell),
        Some("powershell") => Some(ShellType::PowerShell),
        _ => {
            let shell_name = shell_path.file_stem();
            if let Some(shell_name) = shell_name {
                let shell_name_path = std::path::Path::new(shell_name);
                if shell_name_path != shell_path {
                    return detect_shell_type(shell_name_path);
                }
            }
            None
        }
    }
}
