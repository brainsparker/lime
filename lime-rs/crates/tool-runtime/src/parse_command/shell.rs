// Adapted from OpenAI Codex shell-command at
// 4aaee872e31abefe0d32e91faab23b09b6968824 (Apache-2.0).
// See LICENSE and NOTICE.

use super::*;

pub(super) fn parse_shell_lc_commands(original: &[String]) -> Option<Vec<ParsedCommand>> {
    // Only handle bash/zsh here; PowerShell is stripped separately without bash parsing.
    let (_, script) = extract_bash_command(original)?;
    Some(parse_shell_script(script))
}

/// Parses command metadata from a Bash-compatible shell script.
pub fn parse_shell_script(script: &str) -> Vec<ParsedCommand> {
    if let Some(all_commands) = try_parse_shell(script)
        .and_then(|tree| try_parse_word_only_commands_sequence(&tree, script))
        .filter(|commands| !commands.is_empty())
    {
        let script_tokens = shlex_split(script).unwrap_or_else(|| vec![script.to_string()]);
        // Strip small formatting helpers (e.g., head/tail/awk/wc/etc) so we
        // bias toward the primary command when pipelines are present.
        // First, drop obvious small formatting helpers (e.g., wc/awk/etc).
        let had_multiple_commands = all_commands.len() > 1;
        // Commands arrive in source order; drop formatting helpers while preserving it.
        let filtered_commands = drop_small_formatting_commands(all_commands);
        if filtered_commands.is_empty() {
            return vec![ParsedCommand::Unknown {
                cmd: script.to_string(),
            }];
        }
        // Build parsed commands, tracking `cd` segments to compute effective file paths.
        let mut commands: Vec<ParsedCommand> = Vec::new();
        let mut cwd: Option<String> = None;
        for tokens in filtered_commands.into_iter() {
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
            let parsed = summarize_main_tokens(&tokens);
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

        if commands.len() > 1 {
            commands.retain(|pc| !matches!(pc, ParsedCommand::Unknown { cmd } if cmd == "true"));
            // Apply the same simplifications used for non-bash parsing, e.g., drop leading `cd`.
            while let Some(next) = simplify_once(&commands) {
                commands = next;
            }
        }
        if commands.len() == 1 {
            // If we reduced to a single command, attribute the full original script
            // for clearer UX in file-reading and listing scenarios, or when there were
            // no connectors in the original script. For pipeline commands (e.g.
            // `rg --files | sed -n`), keep only the primary command.
            let had_connectors = had_multiple_commands
                || script_tokens
                    .iter()
                    .any(|t| t == "|" || t == "&&" || t == "||" || t == ";");
            commands = commands
                .into_iter()
                .map(|pc| match pc {
                    ParsedCommand::Read { name, cmd, path } => {
                        if had_connectors {
                            let has_pipe = script_tokens.iter().any(|t| t == "|");
                            let has_sed_n = script_tokens.windows(2).any(|w| {
                                w.first().map(String::as_str) == Some("sed")
                                    && w.get(1).map(String::as_str) == Some("-n")
                            });
                            if has_pipe && has_sed_n {
                                ParsedCommand::Read {
                                    cmd: script.to_string(),
                                    name,
                                    path,
                                }
                            } else {
                                ParsedCommand::Read { cmd, name, path }
                            }
                        } else {
                            ParsedCommand::Read {
                                cmd: shlex_join(&script_tokens),
                                name,
                                path,
                            }
                        }
                    }
                    ParsedCommand::ListFiles { path, cmd, .. } => {
                        if had_connectors {
                            ParsedCommand::ListFiles { cmd, path }
                        } else {
                            ParsedCommand::ListFiles {
                                cmd: shlex_join(&script_tokens),
                                path,
                            }
                        }
                    }
                    ParsedCommand::Search {
                        query, path, cmd, ..
                    } => {
                        if had_connectors {
                            ParsedCommand::Search { cmd, query, path }
                        } else {
                            ParsedCommand::Search {
                                cmd: shlex_join(&script_tokens),
                                query,
                                path,
                            }
                        }
                    }
                    other => other,
                })
                .collect();
        }
        return commands;
    }
    vec![ParsedCommand::Unknown {
        cmd: script.to_string(),
    }]
}

/// Return true if this looks like a small formatting helper in a pipeline.
/// Examples: `head -n 40`, `tail -n +10`, `wc -l`, `awk ...`, `cut ...`, `tr ...`.
/// We try to keep variants that clearly include a file path (e.g. `tail -n 30 file`).
pub(super) fn is_small_formatting_command(tokens: &[String]) -> bool {
    if tokens.is_empty() {
        return false;
    }
    let cmd = tokens[0].as_str();
    match cmd {
        // Always formatting; typically used in pipes.
        // `nl` is special-cased below to allow `nl <file>` to be treated as a read command.
        "wc" | "tr" | "cut" | "sort" | "uniq" | "tee" | "column" | "yes" | "printf" => true,
        "xargs" => !is_mutating_xargs_command(tokens),
        "awk" => awk_data_file_operand(&tokens[1..]).is_none(),
        "head" => {
            // Treat as formatting when no explicit file operand is present.
            // Common forms: `head -n 40`, `head -c 100`.
            // Keep cases like `head -n 40 file`.
            match tokens {
                // `head`
                [_] => true,
                // `head <file>` or `head -n50`/`head -c100`
                [_, arg] => arg.starts_with('-'),
                // `head -n 40` / `head -c 100` (no file operand)
                [_, flag, count]
                    if (flag == "-n" || flag == "-c")
                        && count.chars().all(|c| c.is_ascii_digit()) =>
                {
                    true
                }
                _ => false,
            }
        }
        "tail" => {
            // Treat as formatting when no explicit file operand is present.
            // Common forms: `tail -n +10`, `tail -n 30`, `tail -c 100`.
            // Keep cases like `tail -n 30 file`.
            match tokens {
                // `tail`
                [_] => true,
                // `tail <file>` or `tail -n30`/`tail -n+10`
                [_, arg] => arg.starts_with('-'),
                // `tail -n 30` / `tail -n +10` (no file operand)
                [_, flag, count]
                    if flag == "-n"
                        && (count.chars().all(|c| c.is_ascii_digit())
                            || (count.starts_with('+')
                                && count[1..].chars().all(|c| c.is_ascii_digit()))) =>
                {
                    true
                }
                // `tail -c 100` / `tail -c +10` (no file operand)
                [_, flag, count]
                    if flag == "-c"
                        && (count.chars().all(|c| c.is_ascii_digit())
                            || (count.starts_with('+')
                                && count[1..].chars().all(|c| c.is_ascii_digit()))) =>
                {
                    true
                }
                _ => false,
            }
        }
        "sed" => {
            // Keep `sed -n <range> file` (treated as a file read elsewhere);
            // keep in-place mutations as unknown actions; otherwise consider it
            // a formatting helper in a pipeline.
            let args = &tokens[1..];
            !sed_has_in_place_flag(args) && sed_read_path(args).is_none()
        }
        _ => false,
    }
}

pub(super) fn is_mutating_xargs_command(tokens: &[String]) -> bool {
    xargs_subcommand(tokens).is_some_and(xargs_is_mutating_subcommand)
}

pub(super) fn xargs_subcommand(tokens: &[String]) -> Option<&[String]> {
    if tokens.first().map(String::as_str) != Some("xargs") {
        return None;
    }
    let mut i = 1;
    while i < tokens.len() {
        let token = &tokens[i];
        if token == "--" {
            return tokens.get(i + 1..).filter(|rest| !rest.is_empty());
        }
        if !token.starts_with('-') {
            return tokens.get(i..).filter(|rest| !rest.is_empty());
        }
        let takes_value = matches!(
            token.as_str(),
            "-E" | "-e" | "-I" | "-L" | "-n" | "-P" | "-s"
        );
        if takes_value && token.len() == 2 {
            i += 2;
        } else {
            i += 1;
        }
    }
    None
}

pub(super) fn xargs_is_mutating_subcommand(tokens: &[String]) -> bool {
    let Some((head, tail)) = tokens.split_first() else {
        return false;
    };
    match head.as_str() {
        "perl" | "ruby" => has_in_place_flag(tail),
        "sed" => sed_has_in_place_flag(tail),
        "rg" => tail.iter().any(|token| token == "--replace"),
        _ => false,
    }
}

pub(super) fn has_in_place_flag(tokens: &[String]) -> bool {
    tokens.iter().any(|token| {
        token == "-i"
            || token.starts_with("-i")
            || token == "-pi"
            || token.starts_with("-pi")
            || token == "--in-place"
            || token.starts_with("--in-place=")
    })
}

pub(super) fn sed_has_in_place_flag(tokens: &[String]) -> bool {
    let mut tokens = tokens.iter();
    while let Some(token) = tokens.next() {
        match token.as_str() {
            "--" => break,
            "-e" | "-f" | "--expression" | "--file" => {
                let _ = tokens.next();
            }
            "--in-place" => return true,
            token if token.starts_with("--in-place=") => return true,
            token if token.starts_with("--") => {}
            token => {
                let Some(short_options) = token.strip_prefix('-') else {
                    continue;
                };
                for (index, option) in short_options.char_indices() {
                    match option {
                        'i' => return true,
                        'e' | 'f' => {
                            if index + option.len_utf8() == short_options.len() {
                                let _ = tokens.next();
                            }
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    false
}

pub(super) fn drop_small_formatting_commands(mut commands: Vec<Vec<String>>) -> Vec<Vec<String>> {
    commands.retain(|tokens| !is_small_formatting_command(tokens));
    commands
}
