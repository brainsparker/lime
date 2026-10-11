// Adapted from OpenAI Codex shell-command at
// 4aaee872e31abefe0d32e91faab23b09b6968824 (Apache-2.0).
// See LICENSE and NOTICE.

use super::*;

/// Validates that this is a `sed -n 123,123p` command.
pub(super) fn is_valid_sed_n_arg(arg: Option<&str>) -> bool {
    let s = match arg {
        Some(s) => s,
        None => return false,
    };
    let core = match s.strip_suffix('p') {
        Some(rest) => rest,
        None => return false,
    };
    let parts: Vec<&str> = core.split(',').collect();
    match parts.as_slice() {
        [num] => !num.is_empty() && num.chars().all(|c| c.is_ascii_digit()),
        [a, b] => {
            !a.is_empty()
                && !b.is_empty()
                && a.chars().all(|c| c.is_ascii_digit())
                && b.chars().all(|c| c.is_ascii_digit())
        }
        _ => false,
    }
}

pub(super) fn sed_read_path(args: &[String]) -> Option<String> {
    let args_no_connector = trim_at_connector(args);
    if sed_has_in_place_flag(&args_no_connector) || !args_no_connector.iter().any(|arg| arg == "-n")
    {
        return None;
    }
    let mut has_range_script = false;
    let mut i = 0;
    while i < args_no_connector.len() {
        let arg = &args_no_connector[i];
        if matches!(arg.as_str(), "-e" | "--expression") {
            if is_valid_sed_n_arg(args_no_connector.get(i + 1).map(String::as_str)) {
                has_range_script = true;
            }
            i += 2;
            continue;
        }
        if matches!(arg.as_str(), "-f" | "--file") {
            i += 2;
            continue;
        }
        i += 1;
    }
    if !has_range_script {
        has_range_script = args_no_connector
            .iter()
            .any(|arg| !arg.starts_with('-') && is_valid_sed_n_arg(Some(arg)));
    }
    if !has_range_script {
        return None;
    }
    let candidates = skip_flag_values(&args_no_connector, &["-e", "-f", "--expression", "--file"]);
    let non_flags: Vec<String> = candidates
        .into_iter()
        .filter(|arg| !arg.starts_with('-'))
        .cloned()
        .collect();
    match non_flags.as_slice() {
        [] => None,
        [first, rest @ ..] if is_valid_sed_n_arg(Some(first)) => rest.first().cloned(),
        [first, ..] => Some(first.clone()),
    }
}

/// Normalize a command by:
/// - Removing `yes`/`no`/`bash -c`/`bash -lc`/`zsh -c`/`zsh -lc` prefixes.
/// - Splitting on `|` and `&&`/`||`/`;
pub(super) fn normalize_tokens(cmd: &[String]) -> Vec<String> {
    match cmd {
        [first, pipe, rest @ ..] if (first == "yes" || first == "y") && pipe == "|" => {
            // Do not re-shlex already-tokenized input; just drop the prefix.
            rest.to_vec()
        }
        [first, pipe, rest @ ..] if (first == "no" || first == "n") && pipe == "|" => {
            // Do not re-shlex already-tokenized input; just drop the prefix.
            rest.to_vec()
        }
        [shell, flag, script]
            if (shell == "bash" || shell == "zsh") && (flag == "-c" || flag == "-lc") =>
        {
            shlex_split(script).unwrap_or_else(|| vec![shell.clone(), flag.clone(), script.clone()])
        }
        _ => cmd.to_vec(),
    }
}

pub(super) fn contains_connectors(tokens: &[String]) -> bool {
    tokens
        .iter()
        .any(|t| t == "&&" || t == "||" || t == "|" || t == ";")
}

pub(super) fn split_on_connectors(tokens: &[String]) -> Vec<Vec<String>> {
    let mut out: Vec<Vec<String>> = Vec::new();
    let mut cur: Vec<String> = Vec::new();
    for t in tokens {
        if t == "&&" || t == "||" || t == "|" || t == ";" {
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
        } else {
            cur.push(t.clone());
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

pub(super) fn trim_at_connector(tokens: &[String]) -> Vec<String> {
    let idx = tokens
        .iter()
        .position(|t| t == "|" || t == "&&" || t == "||" || t == ";")
        .unwrap_or(tokens.len());
    tokens[..idx].to_vec()
}

/// Shorten a path to the last component, excluding `build`/`dist`/`node_modules`/`src`.
/// It also pulls out a useful path from a directory such as:
/// - webview/src -> webview
/// - foo/src/ -> foo
/// - packages/app/node_modules/ -> app
pub(super) fn short_display_path(path: &str) -> String {
    // Normalize separators and drop any trailing slash for display.
    let normalized = path.replace('\\', "/");
    let trimmed = normalized.trim_end_matches('/');
    let mut parts = trimmed.split('/').rev().filter(|p| {
        !p.is_empty() && *p != "build" && *p != "dist" && *p != "node_modules" && *p != "src"
    });
    parts
        .next()
        .map(str::to_string)
        .unwrap_or_else(|| trimmed.to_string())
}

// Skip values consumed by specific flags and ignore --flag=value style arguments.
pub(super) fn skip_flag_values<'a>(
    args: &'a [String],
    flags_with_vals: &[&str],
) -> Vec<&'a String> {
    let mut out: Vec<&'a String> = Vec::new();
    let mut skip_next = false;
    for (i, a) in args.iter().enumerate() {
        if skip_next {
            skip_next = false;
            continue;
        }
        if a == "--" {
            // From here on, everything is positional operands; push the rest and break.
            for rest in &args[i + 1..] {
                out.push(rest);
            }
            break;
        }
        if a.starts_with("--") && a.contains('=') {
            // --flag=value form: treat as a flag taking a value; skip entirely.
            continue;
        }
        if flags_with_vals.contains(&a.as_str()) {
            // This flag consumes the next argument as its value.
            if i + 1 < args.len() {
                skip_next = true;
            }
            continue;
        }
        out.push(a);
    }
    out
}

pub(super) fn first_non_flag_operand(args: &[String], flags_with_vals: &[&str]) -> Option<String> {
    positional_operands(args, flags_with_vals)
        .into_iter()
        .next()
        .cloned()
}

pub(super) fn single_non_flag_operand(args: &[String], flags_with_vals: &[&str]) -> Option<String> {
    let mut operands = positional_operands(args, flags_with_vals).into_iter();
    let first = operands.next()?;
    if operands.next().is_some() {
        return None;
    }
    Some(first.clone())
}

pub(super) fn positional_operands<'a>(
    args: &'a [String],
    flags_with_vals: &[&str],
) -> Vec<&'a String> {
    let mut out = Vec::new();
    let mut after_double_dash = false;
    let mut skip_next = false;
    for (i, arg) in args.iter().enumerate() {
        if skip_next {
            skip_next = false;
            continue;
        }
        if after_double_dash {
            out.push(arg);
            continue;
        }
        if arg == "--" {
            after_double_dash = true;
            continue;
        }
        if arg.starts_with("--") && arg.contains('=') {
            continue;
        }
        if flags_with_vals.contains(&arg.as_str()) {
            if i + 1 < args.len() {
                skip_next = true;
            }
            continue;
        }
        if arg.starts_with('-') {
            continue;
        }
        out.push(arg);
    }
    out
}

pub(super) fn parse_grep_like(main_cmd: &[String], args: &[String]) -> ParsedCommand {
    let args_no_connector = trim_at_connector(args);
    let mut operands = Vec::new();
    let mut pattern: Option<String> = None;
    let mut after_double_dash = false;
    let mut iter = args_no_connector.iter().peekable();
    while let Some(arg) = iter.next() {
        if after_double_dash {
            operands.push(arg);
            continue;
        }
        if arg == "--" {
            after_double_dash = true;
            continue;
        }
        match arg.as_str() {
            "-e" | "--regexp" => {
                if let Some(pat) = iter.next().filter(|_| pattern.is_none()) {
                    pattern = Some(pat.clone());
                }
                continue;
            }
            "-f" | "--file" => {
                if let Some(pat_file) = iter.next().filter(|_| pattern.is_none()) {
                    pattern = Some(pat_file.clone());
                }
                continue;
            }
            "-m" | "--max-count" | "-C" | "--context" | "-A" | "--after-context" | "-B"
            | "--before-context" => {
                iter.next();
                continue;
            }
            _ => {}
        }
        if arg.starts_with('-') {
            continue;
        }
        operands.push(arg);
    }
    // Do not shorten the query: grep patterns may legitimately contain slashes
    // and should be preserved verbatim. Only paths should be shortened.
    let has_pattern = pattern.is_some();
    let query = pattern.or_else(|| operands.first().cloned().map(String::from));
    let path_index = if has_pattern { 0 } else { 1 };
    let path = operands.get(path_index).map(|s| short_display_path(s));
    ParsedCommand::Search {
        cmd: shlex_join(main_cmd),
        query,
        path,
    }
}

pub(super) fn awk_data_file_operand(args: &[String]) -> Option<String> {
    if args.is_empty() {
        return None;
    }
    let args_no_connector = trim_at_connector(args);
    let has_script_file = args_no_connector
        .iter()
        .any(|arg| arg == "-f" || arg == "--file");
    let candidates = skip_flag_values(
        &args_no_connector,
        &["-F", "-v", "-f", "--field-separator", "--assign", "--file"],
    );
    let non_flags: Vec<&String> = candidates
        .into_iter()
        .filter(|arg| !arg.starts_with('-'))
        .collect();
    if has_script_file {
        return non_flags.first().cloned().cloned();
    }
    if non_flags.len() >= 2 {
        return Some(non_flags[1].clone());
    }
    None
}

pub(super) fn python_walks_files(args: &[String]) -> bool {
    let args_no_connector = trim_at_connector(args);
    let mut iter = args_no_connector.iter();
    while let Some(arg) = iter.next() {
        if arg == "-c" {
            if let Some(script) = iter.next() {
                return script.contains("os.walk")
                    || script.contains("os.listdir")
                    || script.contains("os.scandir")
                    || script.contains("glob.glob")
                    || script.contains("glob.iglob")
                    || script.contains("pathlib.Path")
                    || script.contains(".rglob(");
            }
        }
    }
    false
}

pub(super) fn is_python_command(cmd: &str) -> bool {
    cmd == "python"
        || cmd == "python2"
        || cmd == "python3"
        || cmd.starts_with("python2.")
        || cmd.starts_with("python3.")
}

pub(super) fn cd_target(args: &[String]) -> Option<String> {
    if args.is_empty() {
        return None;
    }
    let mut i = 0;
    let mut target: Option<String> = None;
    while i < args.len() {
        let arg = &args[i];
        if arg == "--" {
            return args.get(i + 1).cloned();
        }
        if matches!(arg.as_str(), "-L" | "-P") {
            i += 1;
            continue;
        }
        if arg.starts_with('-') {
            i += 1;
            continue;
        }
        target = Some(arg.clone());
        i += 1;
    }
    target
}

/// Returns whether a command token has an explicit path shape.
pub fn is_pathish(s: &str) -> bool {
    s == "."
        || s == ".."
        || s.starts_with("./")
        || s.starts_with("../")
        || s.contains('/')
        || s.contains('\\')
}

pub(super) fn parse_fd_query_and_path(tail: &[String]) -> (Option<String>, Option<String>) {
    let args_no_connector = trim_at_connector(tail);
    // fd has several flags that take values (e.g., -t/--type, -e/--extension).
    // Skip those values when extracting positional operands.
    let candidates = skip_flag_values(
        &args_no_connector,
        &[
            "-t",
            "--type",
            "-e",
            "--extension",
            "-E",
            "--exclude",
            "--search-path",
        ],
    );
    let non_flags: Vec<&String> = candidates
        .into_iter()
        .filter(|p| !p.starts_with('-'))
        .collect();
    match non_flags.as_slice() {
        [one] => {
            if is_pathish(one) {
                (None, Some(short_display_path(one)))
            } else {
                (Some((*one).clone()), None)
            }
        }
        [q, p, ..] => (Some((*q).clone()), Some(short_display_path(p))),
        _ => (None, None),
    }
}

pub(super) fn parse_find_query_and_path(tail: &[String]) -> (Option<String>, Option<String>) {
    let args_no_connector = trim_at_connector(tail);
    // First positional argument (excluding common unary operators) is the root path
    let mut path: Option<String> = None;
    for a in &args_no_connector {
        if !a.starts_with('-') && *a != "!" && *a != "(" && *a != ")" {
            path = Some(short_display_path(a));
            break;
        }
    }
    // Extract a common name/path/regex pattern if present
    let mut query: Option<String> = None;
    let mut i = 0;
    while i < args_no_connector.len() {
        let a = &args_no_connector[i];
        if a == "-name" || a == "-iname" || a == "-path" || a == "-regex" {
            if i + 1 < args_no_connector.len() {
                query = Some(args_no_connector[i + 1].clone());
            }
            break;
        }
        i += 1;
    }
    (query, path)
}

pub(super) fn is_abs_like(path: &str) -> bool {
    if std::path::Path::new(path).is_absolute() {
        return true;
    }
    let mut chars = path.chars();
    match (chars.next(), chars.next(), chars.next()) {
        // Windows drive path like C:\
        (Some(d), Some(':'), Some('\\')) if d.is_ascii_alphabetic() => return true,
        // UNC path like \\server\share
        (Some('\\'), Some('\\'), _) => return true,
        _ => {}
    }
    false
}

pub(super) fn join_paths(base: &str, rel: &str) -> String {
    if is_abs_like(rel) {
        return rel.to_string();
    }
    if base.is_empty() {
        return rel.to_string();
    }
    let mut buf = PathBuf::from(base);
    buf.push(rel);
    buf.to_string_lossy().to_string()
}
