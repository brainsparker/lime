use super::*;
use serde_json::json;

fn command_item(command: &str, cwd: Option<&str>) -> canonical::ThreadItem {
    let mut item = tests::canonical_thread(false)
        .turns
        .remove(0)
        .items
        .remove(0);
    item.kind = canonical::ItemKind::Command;
    item.payload = canonical::ThreadItemPayload::Command {
        command: command.to_owned(),
        cwd: cwd.map(str::to_owned),
        output: Some("read result".to_owned()),
        exit_code: Some(0),
    };
    item
}

fn actions(item: &v2::ThreadItem) -> Vec<v2::CommandAction> {
    let v2::ThreadItem::CommandExecution {
        command_actions, ..
    } = item
    else {
        panic!("command execution projection");
    };
    command_actions.clone()
}

#[test]
fn command_actions_are_shared_by_live_read_and_paginated_history() {
    let script = "cd docs && cat 'guide name.md' | head -n 3; rg -n 'TODO/a' ../lib; rg --files .";
    let item = command_item(script, Some("/workspace"));
    let expected = vec![
        v2::CommandAction::Read {
            command: "cat 'guide name.md'".to_owned(),
            name: "guide name.md".to_owned(),
            path: PathBuf::from("/workspace")
                .join("docs/guide name.md")
                .components()
                .collect::<PathBuf>()
                .to_string_lossy()
                .into_owned(),
        },
        v2::CommandAction::Search {
            command: "rg -n TODO/a ../lib".to_owned(),
            query: Some("TODO/a".to_owned()),
            path: Some("lib".to_owned()),
        },
        v2::CommandAction::ListFiles {
            command: "rg --files .".to_owned(),
            path: Some(".".to_owned()),
        },
    ];
    let mut thread = tests::canonical_thread(false);
    thread.turns[0].items = vec![item.clone()];
    let restored = project_thread(thread).expect("cold thread projection");
    assert_eq!(actions(&restored.turns[0].items[0]), expected);

    let page = project_thread_items_list_response(canonical::ThreadItemsListResponse {
        data: vec![item.clone()],
        next_cursor: Some("older".to_owned()),
        backwards_cursor: None,
    })
    .expect("canonical item page");
    assert_eq!(actions(&page.data[0].item), expected);
    assert_eq!(page.next_cursor.as_deref(), Some("older"));

    for (event_type, status) in [
        ("item.started", canonical::ItemStatus::InProgress),
        ("item.completed", canonical::ItemStatus::Completed),
    ] {
        let mut live_item = item.clone();
        live_item.status = status;
        let event = AgentEvent {
            event_id: "event-command".to_owned(),
            sequence: 1,
            session_id: item.session_id.as_str().to_owned(),
            thread_id: Some(item.thread_id.as_str().to_owned()),
            turn_id: Some(item.turn_id.as_str().to_owned()),
            event_type: event_type.to_owned(),
            timestamp: "2026-10-12T00:00:00Z".to_owned(),
            payload: json!({"item": live_item}),
        };
        let Some(ProjectedEvent::Item(projected)) = project_event(&event) else {
            panic!("live canonical command");
        };
        assert_eq!(actions(&projected), expected);
    }
}

#[test]
fn unknown_command_collapses_the_whole_script_without_hiding_mutations() {
    for script in [
        "cat README.md && cargo test",
        "cat README.md > output.txt",
        "cat $(printf README.md)",
        "rg --files | xargs sed -i 's/a/b/g'",
    ] {
        let projected = project_item(command_item(script, Some("/workspace"))).unwrap();
        assert_eq!(
            actions(&projected),
            vec![v2::CommandAction::Unknown {
                command: script.to_owned(),
            }]
        );
    }
}

#[test]
fn command_read_paths_use_the_item_cwd_and_user_shell_keeps_its_source() {
    let mut item = command_item("cat README.md", None);
    item.metadata = json!({"commandExecutionSource": "userShell"});
    let projected = project_item(item).unwrap();
    assert_eq!(
        actions(&projected),
        vec![v2::CommandAction::Read {
            command: "cat README.md".to_owned(),
            name: "README.md".to_owned(),
            path: "README.md".to_owned(),
        }]
    );
    assert!(matches!(
        projected,
        v2::ThreadItem::CommandExecution {
            source: v2::CommandExecutionSource::UserShell,
            ..
        }
    ));
}

#[test]
fn durable_argv_preserves_powershell_paths_and_invalid_facts_stay_opaque() {
    let script = r"Get-Content -Raw 'docs\guide one.md'";
    let mut item = command_item(script, Some("/workspace"));
    item.metadata = json!({"commandArgv": ["powershell", "-NoProfile", "-Command", script]});
    assert_eq!(
        actions(&project_item(item).unwrap()),
        vec![v2::CommandAction::Read {
            command: script.to_owned(),
            name: "guide one.md".to_owned(),
            path: PathBuf::from("/workspace")
                .join("docs/guide one.md")
                .components()
                .collect::<PathBuf>()
                .to_string_lossy()
                .into_owned(),
        }]
    );
    for argv in [json!([]), json!(["cat", 123]), json!("cat README.md")] {
        let mut item = command_item("cat README.md", Some("/workspace"));
        item.metadata = json!({"commandArgv": argv});
        assert_eq!(
            actions(&project_item(item).unwrap()),
            vec![v2::CommandAction::Unknown {
                command: "cat README.md".to_owned(),
            }]
        );
    }
}

#[test]
fn canonical_unified_exec_sources_are_preserved() {
    for (source, expected) in [
        (
            "unifiedExecStartup",
            v2::CommandExecutionSource::UnifiedExecStartup,
        ),
        (
            "unified_exec_startup",
            v2::CommandExecutionSource::UnifiedExecStartup,
        ),
        (
            "unifiedExecInteraction",
            v2::CommandExecutionSource::UnifiedExecInteraction,
        ),
        (
            "unified_exec_interaction",
            v2::CommandExecutionSource::UnifiedExecInteraction,
        ),
    ] {
        let mut item = command_item("cat README.md", Some("/workspace"));
        item.metadata = json!({"commandExecutionSource": source});
        assert!(
            matches!(project_item(item).unwrap(), v2::ThreadItem::CommandExecution {
            source, ..
        } if source == expected)
        );
    }
}
