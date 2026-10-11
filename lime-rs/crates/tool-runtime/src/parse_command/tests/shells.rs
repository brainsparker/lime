use super::*;

#[test]
fn powershell_with_path_is_stripped() {
    let command = if cfg!(windows) {
        "C:\\windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    } else {
        "/usr/local/bin/powershell.exe"
    };

    assert_parsed(
        &vec_str(&[command, "-NoProfile", "-c", "Write-Host hi"]),
        vec![ParsedCommand::Unknown {
            cmd: "Write-Host hi".to_string(),
        }],
    );
}

#[test]
fn preserves_rg_with_spaces() {
    assert_parsed(
        &shlex_split_safe("yes | rg -n 'foo bar' -S"),
        vec![ParsedCommand::Search {
            cmd: "rg -n 'foo bar' -S".to_string(),
            query: Some("foo bar".to_string()),
            path: None,
        }],
    );
}

#[test]
fn ls_with_glob() {
    assert_parsed(
        &shlex_split_safe("ls -I '*.test.js'"),
        vec![ParsedCommand::ListFiles {
            cmd: "ls -I '*.test.js'".to_string(),
            path: None,
        }],
    );
}

#[test]
fn strips_true_in_sequence() {
    // `true` should be dropped from parsed sequences
    assert_parsed(
        &shlex_split_safe("true && rg --files"),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );

    assert_parsed(
        &shlex_split_safe("rg --files && true"),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );
}

#[test]
fn strips_true_inside_bash_lc() {
    let inner = "true && rg --files";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner]),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );

    let inner2 = "rg --files || true";
    assert_parsed(
        &vec_str(&["bash", "-lc", inner2]),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );
}

#[test]
fn shorten_path_on_windows() {
    assert_parsed(
        &shlex_split_safe(r#"cat "pkg\src\main.rs""#),
        vec![ParsedCommand::Read {
            cmd: r#"cat "pkg\\src\\main.rs""#.to_string(),
            name: "main.rs".to_string(),
            path: PathBuf::from(r#"pkg\src\main.rs"#),
        }],
    );
}

#[test]
fn head_with_no_space() {
    assert_parsed(
        &shlex_split_safe("bash -lc 'head -n50 Cargo.toml'"),
        vec![ParsedCommand::Read {
            cmd: "head -n50 Cargo.toml".to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("Cargo.toml"),
        }],
    );
}

#[test]
fn bash_dash_c_pipeline_parsing() {
    // Ensure -c is handled similarly to -lc by shell parsing
    let inner = "rg --files | head -n 1";
    assert_parsed(
        &vec_str(&["bash", "-c", inner]),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );
}

#[test]
fn tail_with_no_space() {
    assert_parsed(
        &shlex_split_safe("bash -lc 'tail -n+10 README.md'"),
        vec![ParsedCommand::Read {
            cmd: "tail -n+10 README.md".to_string(),
            name: "README.md".to_string(),
            path: PathBuf::from("README.md"),
        }],
    );
}

#[test]
fn grep_with_query_and_path() {
    assert_parsed(
        &shlex_split_safe("grep -R TODO src"),
        vec![ParsedCommand::Search {
            cmd: "grep -R TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn supports_ag_ack_pt_rga() {
    assert_parsed(
        &shlex_split_safe("ag TODO src"),
        vec![ParsedCommand::Search {
            cmd: "ag TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("ack TODO src"),
        vec![ParsedCommand::Search {
            cmd: "ack TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("pt TODO src"),
        vec![ParsedCommand::Search {
            cmd: "pt TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("rga TODO src"),
        vec![ParsedCommand::Search {
            cmd: "rga TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn ag_ack_pt_files_with_matches_flags_are_search() {
    assert_parsed(
        &shlex_split_safe("ag -l TODO src"),
        vec![ParsedCommand::Search {
            cmd: "ag -l TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("ack -l TODO src"),
        vec![ParsedCommand::Search {
            cmd: "ack -l TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
    assert_parsed(
        &shlex_split_safe("pt -l TODO src"),
        vec![ParsedCommand::Search {
            cmd: "pt -l TODO src".to_string(),
            query: Some("TODO".to_string()),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn rg_with_equals_style_flags() {
    assert_parsed(
        &shlex_split_safe("rg --colors=never -n foo src"),
        vec![ParsedCommand::Search {
            cmd: "rg '--colors=never' -n foo src".to_string(),
            query: Some("foo".to_string()),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn cat_with_double_dash_and_sed_ranges() {
    // cat -- <file> should be treated as a read of that file
    assert_parsed(
        &shlex_split_safe("cat -- ./-strange-file-name"),
        vec![ParsedCommand::Read {
            cmd: "cat -- ./-strange-file-name".to_string(),
            name: "-strange-file-name".to_string(),
            path: PathBuf::from("./-strange-file-name"),
        }],
    );

    // sed -n <range> <file> should be treated as a read of <file>
    assert_parsed(
        &shlex_split_safe("sed -n '12,20p' Cargo.toml"),
        vec![ParsedCommand::Read {
            cmd: "sed -n '12,20p' Cargo.toml".to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("Cargo.toml"),
        }],
    );
}

#[test]
fn drop_trailing_nl_in_pipeline() {
    // When an `nl` stage has only flags, it should be dropped from the summary
    assert_parsed(
        &shlex_split_safe("rg --files | nl -ba"),
        vec![ParsedCommand::ListFiles {
            cmd: "rg --files".to_string(),
            path: None,
        }],
    );
}

#[test]
fn ls_with_time_style_and_path() {
    assert_parsed(
        &shlex_split_safe("ls --time-style=long-iso ./dist"),
        vec![ParsedCommand::ListFiles {
            cmd: "ls '--time-style=long-iso' ./dist".to_string(),
            // short_display_path drops "dist" and shows "." as the last useful segment
            path: Some(".".to_string()),
        }],
    );
}

#[test]
fn fd_file_finder_variants() {
    assert_parsed(
        &shlex_split_safe("fd -t f src/"),
        vec![ParsedCommand::ListFiles {
            cmd: "fd -t f src/".to_string(),
            path: Some("src".to_string()),
        }],
    );

    // fd with query and path should capture both
    assert_parsed(
        &shlex_split_safe("fd main src"),
        vec![ParsedCommand::Search {
            cmd: "fd main src".to_string(),
            query: Some("main".to_string()),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn find_basic_name_filter() {
    assert_parsed(
        &shlex_split_safe("find . -name '*.rs'"),
        vec![ParsedCommand::Search {
            cmd: "find . -name '*.rs'".to_string(),
            query: Some("*.rs".to_string()),
            path: Some(".".to_string()),
        }],
    );
}

#[test]
fn find_type_only_path() {
    assert_parsed(
        &shlex_split_safe("find src -type f"),
        vec![ParsedCommand::ListFiles {
            cmd: "find src -type f".to_string(),
            path: Some("src".to_string()),
        }],
    );
}

#[test]
fn bin_bash_lc_sed() {
    assert_parsed(
        &shlex_split_safe("/bin/bash -lc 'sed -n '1,10p' Cargo.toml'"),
        vec![ParsedCommand::Read {
            cmd: "sed -n '1,10p' Cargo.toml".to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("Cargo.toml"),
        }],
    );
}
#[test]
fn bin_zsh_lc_sed() {
    assert_parsed(
        &shlex_split_safe("/bin/zsh -lc 'sed -n '1,10p' Cargo.toml'"),
        vec![ParsedCommand::Read {
            cmd: "sed -n '1,10p' Cargo.toml".to_string(),
            name: "Cargo.toml".to_string(),
            path: PathBuf::from("Cargo.toml"),
        }],
    );
}

#[test]
fn powershell_command_is_stripped() {
    assert_parsed(
        &vec_str(&["powershell", "-Command", "Get-ChildItem"]),
        vec![ParsedCommand::Unknown {
            cmd: "Get-ChildItem".to_string(),
        }],
    );
}

#[test]
fn powershell_file_reads_are_classified() {
    for (shell, script, path) in [
        (
            "powershell",
            r"Get-Content C:\skills\demo\SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
        (
            "powershell",
            r#"get-content -Raw "C:\skills and plugins\SKILL.md""#,
            "C:/skills and plugins/SKILL.md",
        ),
        (
            "powershell",
            r"Get-Content 'C:\skills and plugins\SKILL.md'",
            "C:/skills and plugins/SKILL.md",
        ),
        (
            "powershell",
            r"Get-Content -Path C:\skills\demo\SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
        (
            "powershell",
            r"Get-Content -LiteralPath C:\skills\demo\SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
        (
            "powershell",
            r"Get-Content C:\skills\demo\SKILL.md -Raw",
            "C:/skills/demo/SKILL.md",
        ),
        (
            "powershell",
            r"Get-Content -Raw -LiteralPath C:\skills\demo\SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
        (
            "powershell",
            r"Get-Content C:\workspace\README.md",
            "C:/workspace/README.md",
        ),
        (
            "powershell",
            "gc C:/skills/demo/SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
        (
            "powershell",
            "type C:/skills/demo/SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
        (
            r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            "Get-Content C:/skills/demo/SKILL.md",
            "C:/skills/demo/SKILL.md",
        ),
    ] {
        assert_parsed(
            &vec_str(&[shell, "-NoProfile", "-Command", script]),
            vec![ParsedCommand::Read {
                cmd: script.to_string(),
                name: PathBuf::from(path)
                    .file_name()
                    .expect("file path")
                    .to_string_lossy()
                    .into_owned(),
                path: PathBuf::from(path),
            }],
        );
    }
}

#[test]
fn complex_powershell_file_reads_are_intentionally_not_classified() {
    for script in [
        r"Get-Content 'C:\Users\O''Brien\skill\SKILL.md'",
        r#"Get-Content "$(Remove-Item C:/important)/skills/demo/SKILL.md""#,
        "Get-Content -ReadCount:([IO.File]::Delete('C:/important')) C:/skills/demo/SKILL.md",
        "Get-Content C:/Users/Alice/.ssh/id_rsa,C:/skills/demo/SKILL.md",
        "Get-Content C:/skills/demo/SKILL.md -Raw; Remove-Item C:/important",
        "Get-Content C:/skills/demo/SKILL.md C:/important",
        "Get-Content C:/skills/*/SKILL.md",
        "Get-Content -Encoding UTF8 C:/skills/demo/SKILL.md",
        "Get-Content -Raw",
    ] {
        assert_parsed(
            &vec_str(&["powershell", "-Command", script]),
            vec![ParsedCommand::Unknown {
                cmd: script.to_string(),
            }],
        );
    }
}

#[test]
fn pwsh_with_noprofile_and_c_alias_is_stripped() {
    assert_parsed(
        &vec_str(&["pwsh", "-NoProfile", "-c", "Write-Host hi"]),
        vec![ParsedCommand::Unknown {
            cmd: "Write-Host hi".to_string(),
        }],
    );
}
