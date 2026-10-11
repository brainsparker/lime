// Adapted from OpenAI Codex shell-command at
// 4aaee872e31abefe0d32e91faab23b09b6968824 (Apache-2.0).
// See parse_command/LICENSE and parse_command/NOTICE.

//! Shared command presentation metadata; never an approval or safety classifier.

use self::bash::extract_bash_command;
use self::bash::try_parse_shell;
use self::bash::try_parse_word_only_commands_sequence;
use self::powershell::extract_powershell_command;
use agent_protocol::parse_command::ParsedCommand;
use shlex::split as shlex_split;
use shlex::try_join as shlex_try_join;
use std::path::PathBuf;

pub fn shlex_join(tokens: &[String]) -> String {
    shlex_try_join(tokens.iter().map(String::as_str))
        .unwrap_or_else(|_| "<command included NUL byte>".to_string())
}

/// Tokenizes a PowerShell command while preserving Windows paths and reader aliases.
pub fn tokenize_powershell_command(command: &str) -> Vec<String> {
    let normalized = command.replace('\\', "/");
    let mut tokens = shlex_split(&normalized)
        .unwrap_or_else(|| normalized.split_whitespace().map(str::to_string).collect());
    if let Some(executable) = tokens.first_mut().filter(|executable| {
        matches!(
            executable.to_ascii_lowercase().as_str(),
            "get-content" | "gc" | "type"
        )
    }) {
        *executable = "Get-Content".to_owned();
        // POSIX shlex must not silently rewrite a PowerShell file path.
        if tokens
            .iter()
            .skip(1)
            .any(|argument| !normalized.contains(argument))
        {
            return Vec::new();
        }
    }
    tokens
}

/// Extracts the shell and script from a command, regardless of platform
pub fn extract_shell_command(command: &[String]) -> Option<(&str, &str)> {
    extract_bash_command(command).or_else(|| extract_powershell_command(command))
}

/// Parse display metadata, collapsing unknown commands into the original invocation.
pub fn parse_command(command: &[String]) -> Vec<ParsedCommand> {
    // Parse and then collapse consecutive duplicate commands to avoid redundant summaries.
    let parsed = parse_command_impl(command);
    let mut deduped: Vec<ParsedCommand> = Vec::with_capacity(parsed.len());
    for cmd in parsed.into_iter() {
        if deduped.last().is_some_and(|prev| prev == &cmd) {
            continue;
        }
        deduped.push(cmd);
    }
    if deduped
        .iter()
        .any(|cmd| matches!(cmd, ParsedCommand::Unknown { .. }))
    {
        vec![single_unknown_for_command(command)]
    } else {
        deduped
    }
}

fn single_unknown_for_command(command: &[String]) -> ParsedCommand {
    if let Some((_, shell_command)) = extract_shell_command(command) {
        ParsedCommand::Unknown {
            cmd: shell_command.to_string(),
        }
    } else {
        ParsedCommand::Unknown {
            cmd: shlex_join(command),
        }
    }
}
fn parse_command_impl(command: &[String]) -> Vec<ParsedCommand> {
    if let Some(commands) = parse_shell_lc_commands(command) {
        return commands;
    }

    let powershell_command = command
        .first()
        .filter(|shell| shell.contains('\\'))
        .map(|shell| {
            let mut normalized = command.to_vec();
            normalized[0] = shell.rsplit(['/', '\\']).next().unwrap_or(shell).to_owned();
            normalized
        });
    if let Some((_, script)) =
        extract_powershell_command(powershell_command.as_deref().unwrap_or(command))
    {
        let tokens = tokenize_powershell_command(script);
        if tokens
            .first()
            .is_some_and(|executable| executable == "Get-Content")
        {
            if let [ParsedCommand::Read { name, path, .. }] = parse_command_impl(&tokens).as_slice()
            {
                return vec![ParsedCommand::Read {
                    cmd: script.to_string(),
                    name: name.clone(),
                    path: path.clone(),
                }];
            }
        }
        return vec![ParsedCommand::Unknown {
            cmd: script.to_string(),
        }];
    }

    let normalized = normalize_tokens(command);

    let parts = if contains_connectors(&normalized) {
        split_on_connectors(&normalized)
    } else {
        vec![normalized]
    };

    // Preserve left-to-right execution order for all commands, including bash -c/-lc
    // so summaries reflect the order they will run.

    // Map each pipeline segment to its parsed summary, tracking `cd` to compute paths.
    let mut commands: Vec<ParsedCommand> = Vec::new();
    let mut cwd: Option<String> = None;
    for tokens in &parts {
        if let Some((_, tail)) = tokens
            .split_first()
            .filter(|(head, _)| head.as_str() == "cd")
        {
            if let Some(dir) = cd_target(tail) {
                cwd = Some(match &cwd {
                    Some(base) => join_paths(base, &dir),
                    None => dir.clone(),
                });
            }
            continue;
        }
        let parsed = summarize_main_tokens(tokens);
        let parsed = match parsed {
            ParsedCommand::Read { cmd, name, path } => {
                if let Some(base) = &cwd {
                    let full = join_paths(base, &path.to_string_lossy());
                    ParsedCommand::Read {
                        cmd,
                        name,
                        path: PathBuf::from(full),
                    }
                } else {
                    ParsedCommand::Read { cmd, name, path }
                }
            }
            other => other,
        };
        commands.push(parsed);
    }

    while let Some(next) = simplify_once(&commands) {
        commands = next;
    }

    commands
}

fn simplify_once(commands: &[ParsedCommand]) -> Option<Vec<ParsedCommand>> {
    if commands.len() <= 1 {
        return None;
    }

    // echo ... && ...rest => ...rest
    if matches!(&commands[0], ParsedCommand::Unknown { cmd }
        if shlex_split(cmd).is_some_and(|t| t.first().map(String::as_str) == Some("echo")))
    {
        return Some(commands[1..].to_vec());
    }

    // cd foo && [any command] => [any command] (keep non-cd when a cd is followed by something)
    if let Some(idx) = commands
        .iter()
        .position(|pc| match pc {
            ParsedCommand::Unknown { cmd } => {
                shlex_split(cmd).is_some_and(|t| t.first().map(String::as_str) == Some("cd"))
            }
            _ => false,
        })
        .filter(|idx| commands.len() > *idx + 1)
    {
        let mut out = Vec::with_capacity(commands.len() - 1);
        out.extend_from_slice(&commands[..idx]);
        out.extend_from_slice(&commands[idx + 1..]);
        return Some(out);
    }

    // cmd || true => cmd
    if let Some(idx) = commands
        .iter()
        .position(|pc| matches!(pc, ParsedCommand::Unknown { cmd } if cmd == "true"))
    {
        let mut out = Vec::with_capacity(commands.len() - 1);
        out.extend_from_slice(&commands[..idx]);
        out.extend_from_slice(&commands[idx + 1..]);
        return Some(out);
    }

    // nl -[any_flags] && ...rest => ...rest
    if let Some(idx) = commands.iter().position(|pc| match pc {
        ParsedCommand::Unknown { cmd } => {
            if let Some(tokens) = shlex_split(cmd) {
                tokens.first().is_some_and(|s| s.as_str() == "nl")
                    && tokens.iter().skip(1).all(|t| t.starts_with('-'))
            } else {
                false
            }
        }
        _ => false,
    }) {
        let mut out = Vec::with_capacity(commands.len() - 1);
        out.extend_from_slice(&commands[..idx]);
        out.extend_from_slice(&commands[idx + 1..]);
        return Some(out);
    }

    None
}

mod bash;
mod operands;
mod powershell;
mod shell;
mod shell_detect;
mod summary;

use operands::*;
pub use shell::parse_shell_script;
use shell::*;
use summary::summarize_main_tokens;

#[cfg(test)]
mod tests;
