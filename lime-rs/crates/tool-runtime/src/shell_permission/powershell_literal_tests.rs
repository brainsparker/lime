// Codex fixture outputs were captured from the real PowerShell AST parser.
use serde::Deserialize;

use super::try_parse_powershell_commands;

#[derive(Deserialize)]
struct Case {
    name: String,
    script: String,
    expected: Option<Vec<Vec<String>>>,
}

#[test]
fn literal_lowering_matches_powershell_ast_corpus() {
    let cases: Vec<Case> = serde_json::from_str(include_str!("powershell_lowering.json")).unwrap();
    for case in cases {
        assert_eq!(
            try_parse_powershell_commands(&case.script),
            case.expected,
            "{}: {}",
            case.name,
            case.script
        );
    }
}
