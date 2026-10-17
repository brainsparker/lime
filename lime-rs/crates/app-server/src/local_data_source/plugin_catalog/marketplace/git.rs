use super::*;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

async fn run(args: &[&str], cwd: Option<&Path>) -> Result<String, Error> {
    let mut command = Command::new("git");
    command
        .args(["-c", "safe.bareRepository=explicit"])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let output = tokio::time::timeout(Duration::from_secs(30), command.output())
        .await
        .map_err(|_| internal("marketplace Git operation timed out after 30s"))?
        .map_err(internal)?;
    if !output.status.success() {
        return Err(internal(format!(
            "marketplace Git operation failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub(super) async fn revision(config: &MarketplaceConfig) -> Result<String, Error> {
    let source = config
        .source
        .as_deref()
        .ok_or_else(|| invalid("configured Git marketplace is missing source"))?;
    let reference = config.ref_name.as_deref().unwrap_or("HEAD");
    if reference.len() == 40 && reference.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Ok(reference.to_owned());
    }
    let output = run(&["ls-remote", "--", source, reference], None).await?;
    output
        .lines()
        .next()
        .and_then(|line| line.split_once('\t'))
        .map(|(sha, _)| sha.to_string())
        .filter(|sha| !sha.is_empty())
        .ok_or_else(|| internal("marketplace Git source returned no revision"))
}

pub(super) async fn clone(config: &MarketplaceConfig, destination: &Path) -> Result<String, Error> {
    let source = config
        .source
        .as_deref()
        .ok_or_else(|| invalid("configured Git marketplace is missing source"))?;
    let destination_arg = git_path(destination);
    let sparse = config.sparse_paths.as_deref().unwrap_or_default();
    if sparse.is_empty() {
        run(&["clone", "--", source, &destination_arg], None).await?;
    } else {
        run(
            &[
                "clone",
                "--filter=blob:none",
                "--no-checkout",
                "--",
                source,
                &destination_arg,
            ],
            None,
        )
        .await?;
        let mut args = vec!["sparse-checkout", "set", "--"];
        args.extend(sparse.iter().map(String::as_str));
        run(&args, Some(destination)).await?;
    }
    if config.ref_name.is_some() || !sparse.is_empty() {
        run(
            &["checkout", config.ref_name.as_deref().unwrap_or("HEAD")],
            Some(destination),
        )
        .await?;
    }
    let revision = run(&["rev-parse", "HEAD"], Some(destination)).await?;
    if revision.is_empty() {
        return Err(internal("marketplace Git checkout has no revision"));
    }
    Ok(revision)
}

fn git_path(path: &Path) -> String {
    let value = path.to_string_lossy();
    #[cfg(windows)]
    {
        if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{rest}");
        }
        if let Some(rest) = value.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    value.into_owned()
}
