mod bash;
mod common;
mod powershell;

use std::path::{Path, PathBuf};

use crate::path_guard::PathMutationCandidate;

pub fn is_bash_command_concurrency_safe(command: &str) -> bool {
    bash::is_command_concurrency_safe(command)
}

pub fn is_powershell_command_concurrency_safe(command: &str) -> bool {
    powershell::is_command_concurrency_safe(command)
}

pub fn missing_bash_read_targets(command: &str, cwd: &Path) -> Vec<PathBuf> {
    bash::missing_read_targets(command, cwd)
}

pub fn missing_powershell_read_targets(command: &str, cwd: &Path) -> Vec<PathBuf> {
    powershell::missing_read_targets(command, cwd)
}

pub fn command_references_wsl_drive_mount(command: &str) -> bool {
    common::command_references_wsl_drive_mount(command)
}

pub(crate) fn collect_bash_invocation_path_candidates(
    words: &[String],
) -> Vec<PathMutationCandidate> {
    bash::collect_invocation_path_candidates(words)
}

pub(crate) fn collect_powershell_invocation_path_candidates(
    words: &[String],
) -> Vec<PathMutationCandidate> {
    powershell::collect_invocation_path_candidates(words)
}

pub(crate) fn detect_high_risk_bash_reason(command: &str) -> Option<String> {
    bash::detect_high_risk_reason(command)
}

pub(crate) fn detect_high_risk_powershell_invocation_reason(words: &[String]) -> Option<String> {
    powershell::detect_high_risk_invocation_reason(words)
}

pub(crate) fn detect_mutating_bash_invocation_warning(words: &[String]) -> Option<String> {
    bash::detect_mutating_invocation_warning(words)
}

pub(crate) fn detect_mutating_powershell_invocation_warning(words: &[String]) -> Option<String> {
    powershell::detect_mutating_invocation_warning(words)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn bash_read_target_reports_missing_file() {
        let cwd = std::env::temp_dir().join(format!(
            "tool-runtime-shell-analysis-{}",
            std::process::id()
        ));
        fs::create_dir_all(&cwd).unwrap();
        let missing = missing_bash_read_targets("cat missing.txt", &cwd);
        assert_eq!(missing, vec![cwd.join("missing.txt")]);
        let _ = fs::remove_dir_all(&cwd);
    }

    #[test]
    fn bash_read_target_ignores_file_descriptor_redirection() {
        let cwd = std::env::temp_dir().join(format!(
            "tool-runtime-shell-analysis-redirection-{}",
            std::process::id()
        ));
        let packages = cwd.join("packages");
        fs::create_dir_all(&packages).unwrap();

        let missing =
            missing_bash_read_targets("ls packages/ 2>/dev/null || echo \"no packages dir\"", &cwd);

        assert!(missing.is_empty());
        let _ = fs::remove_dir_all(&cwd);
    }

    #[test]
    fn powershell_read_target_reports_missing_file() {
        let cwd = std::env::temp_dir().join(format!(
            "tool-runtime-shell-analysis-pwsh-{}",
            std::process::id()
        ));
        fs::create_dir_all(&cwd).unwrap();
        let missing = missing_powershell_read_targets("Get-Content missing.txt", &cwd);
        assert_eq!(missing, vec![cwd.join("missing.txt")]);
        let _ = fs::remove_dir_all(&cwd);
    }

    #[test]
    fn bash_concurrency_safe_accepts_read_only_pipeline() {
        assert!(is_bash_command_concurrency_safe("rg foo src | head -20"));
    }

    #[test]
    fn bash_concurrency_safe_rejects_mutation() {
        assert!(!is_bash_command_concurrency_safe("mkdir tmp-output"));
        assert!(!is_bash_command_concurrency_safe("git checkout main"));
    }

    #[test]
    fn powershell_concurrency_safe_accepts_read_only_pipeline() {
        assert!(is_powershell_command_concurrency_safe(
            "Get-Content README.md | Select-String Lime"
        ));
    }

    #[test]
    fn powershell_concurrency_safe_rejects_mutation() {
        assert!(!is_powershell_command_concurrency_safe(
            "Set-Content out.txt hi"
        ));
        assert!(!is_powershell_command_concurrency_safe("git checkout main"));
    }
}
