use super::*;

#[test]
fn git_status_is_unknown() {
    assert_parsed(
        &vec_str(&["git", "status"]),
        vec![ParsedCommand::Unknown {
            cmd: "git status".to_string(),
        }],
    );
}

#[test]
fn supports_git_grep_and_ls_files() {
    assert_parsed(
        &shlex_split_safe("git grep TODO src"),
        vec![ParsedCommand::Search {
            cmd: "git grep TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("git grep -l TODO src"),
        vec![ParsedCommand::Search {
            cmd: "git grep -l TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("git ls-files"),
        vec![ParsedCommand::ListFiles {
            cmd: "git ls-files".to_string(),
            path: None,
        }],
    );
    assert_parsed(
        &shlex_split_safe("git ls-files src"),
        vec![ParsedCommand::ListFiles {
            cmd: "git ls-files src".to_string(),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("git ls-files --exclude target src"),
        vec![ParsedCommand::ListFiles {
            cmd: "git ls-files --exclude target src".to_string(),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn handles_git_pipe_wc() {
    let inner = "git status | wc -l";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Unknown {
            cmd: inner.to_string(),
        }],
    );
}

#[test]
fn bash_lc_redirect_not_quoted() {
    let inner = "echo foo > bar";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Unknown {
            cmd: "echo foo > bar".to_string(),
        }],
    );
}

#[test]
fn handles_complex_bash_command_head() {
    let inner =
        "rg --version && node -v && pnpm -v && rg --files | wc -l && rg --files | head -n 40";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Unknown {
            cmd: inner.to_string(),
        }],
    );
}

#[test]
fn supports_searching_for_navigate_to_route() {
    let inner = "rg -n \"navigate-to-route\" -S";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Search {
            cmd: "rg -n navigate-to-route -S".to_string(),
            query: Some("navigate-to-route".to_string()),
            path: None,
        }],
    );
}

#[test]
fn handles_complex_bash_command() {
    let inner = "rg -n \"BUG|FIXME|TODO|XXX|HACK\" -S | head -n 200";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Search {
            cmd: "rg -n 'BUG|FIXME|TODO|XXX|HACK' -S".to_string(),
            query: Some("BUG|FIXME|TODO|XXX|HACK".to_string()),
            path: None,
        }],
    );
}

#[test]
fn supports_rg_files_with_path_and_pipe() {
    let inner = "rg --files webview/src | sed -n";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files webview/src".to_string(),
            path: Some("webview".to_string()),
        }],
    );
}

#[test]
fn supports_rg_files_then_head() {
    let inner = "rg --files | head -n 50";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );
}

#[test]
fn keeps_mutating_xargs_pipeline() {
    let inner = r#"rg -l QkBindingController presentation/src/main/java | xargs perl -pi -e 's/QkBindingController/QkController/g'"#;
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Unknown {
            cmd: inner.to_string(),
        }],
    );
}

#[test]
fn collapses_plain_pipeline_when_any_stage_is_unknown() {
    let command = shlex_split_safe(
        "rg -l QkBindingController presentation/src/main/java | xargs perl -pi -e 's/QkBindingController/QkController/g'",
    );
    assert_parsed(
        &command,
        vec![ParsedCommand::Unknown {
            cmd: shlex_join(&command),
        }],
    );
}

#[test]
fn collapses_pipeline_with_helper_when_later_stage_is_unknown() {
    let command = shlex_split_safe("rg --files | nl -ba | foo");
    assert_parsed(
        &command,
        vec![ParsedCommand::Unknown {
            cmd: shlex_join(&command),
        }],
    );
}

#[test]
fn rg_files_with_matches_flags_are_search() {
    assert_parsed(
        &shlex_split_safe("rg -l TODO src"),
        vec![ParsedCommand::Search {
            cmd: "rg -l TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("rg --files-with-matches TODO src"),
        vec![ParsedCommand::Search {
            cmd: "rg --files-with-matches TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("rg -L TODO src"),
        vec![ParsedCommand::Search {
            cmd: "rg -L TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("rg --files-without-match TODO src"),
        vec![ParsedCommand::Search {
            cmd: "rg --files-without-match TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("rga -l TODO src"),
        vec![ParsedCommand::Search {
            cmd: "rga -l TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn supports_cat() {
    let inner = "cat webview/README.md";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("webview/README.md"),
        }],
    );
}

#[test]
fn zsh_lc_supports_cat() {
    let inner = "cat README.md";
    assert_parsed(
        &vec_str(&["zsh", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("README.md"),
        }],
    );
}

#[test]
fn supports_bat() {
    let inner = "bat --theme TwoDark README.md";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("README.md"),
        }],
    );
}

#[test]
fn supports_batcat() {
    let inner = "batcat README.md";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("README.md"),
        }],
    );
}

#[test]
fn supports_less() {
    let inner = "less -p TODO README.md";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("README.md"),
        }],
    );
}

#[test]
fn supports_more() {
    let inner = "more README.md";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("README.md"),
        }],
    );
}

#[test]
fn cd_then_cat_is_single_read() {
    assert_parsed(
        &shlex_split_safe("cd foo && cat foo.txt"),
        vec![ParsedCommand::Read {
            cmd: "cat foo.txt".to_string(),
            name: "foo.txt".to_string(),
            path: PathBuf::from("foo/foo.txt"),
        }],
    );
}

#[test]
fn cd_with_double_dash_then_cat_is_read() {
    assert_parsed(
        &shlex_split_safe("cd -- -weird && cat foo.txt"),
        vec![ParsedCommand::Read {
            cmd: "cat foo.txt".to_string(),
            name: "foo.txt".to_string(),
            path: PathBuf::from("-weird/foo.txt"),
        }],
    );
}

#[test]
fn cd_with_multiple_operands_uses_last() {
    assert_parsed(
        &shlex_split_safe("cd dir1 dir2 && cat foo.txt"),
        vec![ParsedCommand::Read {
            cmd: "cat foo.txt".to_string(),
            name: "foo.txt".to_string(),
            path: PathBuf::from("dir2/foo.txt"),
        }],
    );
}

#[test]
fn bash_cd_then_bar_is_same_as_bar() {
    // Ensure a leading `cd` inside bash -lc is dropped when followed by another command.
    assert_parsed(
        &shlex_split_safe("bash -lc 'cd foo && bar'"),
        vec![ParsedCommand::Unknown {
            cmd: "cd foo && bar".to_string(),
        }],
    );
}

#[test]
fn bash_cd_then_cat_is_read() {
    assert_parsed(
        &shlex_split_safe("bash -lc 'cd foo && cat foo.txt'"),
        vec![ParsedCommand::Read {
            cmd: "cat foo.txt".to_string(),
            name: "foo.txt".to_string(),
            path: PathBuf::from("foo/foo.txt"),
        }],
    );
}

#[test]
fn supports_ls_with_pipe() {
    let inner = "ls -la | sed -n '1,120p'";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::ListFiles {
            cmd: "ls -la".to_string(),
            path: None,
        }],
    );
}

#[test]
fn supports_eza_exa_tree_du() {
    assert_parsed(
        &shlex_split_safe("eza --color=always src"),
        vec![ParsedCommand::ListFiles {
            cmd: "eza '--color=always' src".to_string(),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("exa -I target ."),
        vec![ParsedCommand::ListFiles {
            cmd: "exa -I target .".to_string(),
            path: Some(".".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("tree -L 2 src"),
        vec![ParsedCommand::ListFiles {
            cmd: "tree -L 2 src".to_string(),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("du -d 2 ."),
        vec![ParsedCommand::ListFiles {
            cmd: "du -d 2 .".to_string(),
            path: Some(".".to_string()),
        }],
    );
}

#[test]
fn supports_head_n() {
    let inner = "head -n 50 Cargo.toml";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("Cargo.toml"),
        }],
    );
}

#[test]
fn supports_head_file_only() {
    let inner = "head Cargo.toml";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("Cargo.toml"),
        }],
    );
}

#[test]
fn supports_cat_sed_n() {
    let inner = "cat tui/Cargo.toml | sed -n '1,200p'";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::Read {
            cmd: inner.to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("tui/Cargo.toml"),
        }],
    );
}
