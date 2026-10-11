// Adapted from OpenAI Codex shell-command at
// 4aaee872e31abefe0d32e91faab23b09b6968824 (Apache-2.0).
// See LICENSE and NOTICE.

use super::*;
use std::path::PathBuf;
use std::string::ToString;

fn shlex_split_safe(s: &str) -> Vec<String> {
    shlex_split(s).unwrap_or_else(|| s.split_whitespace().map(ToString::to_string).collect())
}

fn vec_str(args: &[&str]) -> Vec<String> {
    args.iter().map(ToString::to_string).collect()
}

fn assert_parsed(args: &[String], expected: Vec<ParsedCommand>) {
    let out = parse_command(args);
    assert_eq!(out, expected);
}

mod commands;
mod pipelines;
mod shells;
