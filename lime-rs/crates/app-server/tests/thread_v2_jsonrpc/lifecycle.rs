use super::*;

async fn assert_unarchive_rejected(server: &AppServer, id: u64, thread_id: &str) {
    let lines = request_lines(
        server,
        id,
        METHOD_THREAD_UNARCHIVE,
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(
        lines.len(),
        1,
        "a rejected mutation must not emit success or environment notifications"
    );
    assert_eq!(
        lines[0].pointer("/error/code"),
        Some(&json!(error_codes::INVALID_REQUEST))
    );
    assert_eq!(
        lines[0].pointer("/error/message"),
        Some(&json!(format!(
            "no archived rollout found for thread id {thread_id}"
        )))
    );
    assert!(lines[0].get("result").is_none());
}

#[tokio::test]
async fn thread_archive_moves_the_dated_rollout_and_unarchive_restores_it() {
    let (temp, server) = test_server();
    initialize_server(&server).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model": "gpt-5.4",
            "modelProvider": "openai",
            "historyMode": "paginated",
            "environments": [{
                "environmentId": "local",
                "cwd": "/tmp/lime-thread-environment"
            }]
        }),
    )
    .await;
    let thread_id = started
        .pointer("/result/thread/id")
        .and_then(Value::as_str)
        .expect("thread/start id")
        .to_string();
    assert_unarchive_rejected(&server, 20, &thread_id).await;
    assert_unarchive_rejected(&server, 21, "missing-thread").await;
    let agent_root = temp.path().join("agent-root");
    let active_files = rollout_files(&agent_root.join("sessions"));
    assert_eq!(active_files.len(), 1, "one dated rollout must be created");
    let active_path = active_files[0].clone();
    assert_eq!(
        active_path
            .strip_prefix(agent_root.join("sessions"))
            .expect("dated rollout relative path")
            .components()
            .count(),
        4,
        "rollout path must be YYYY/MM/DD/<file>"
    );

    let archive_lines = request_lines(
        &server,
        3,
        METHOD_THREAD_ARCHIVE,
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(
        archive_lines
            .iter()
            .find(|line| line.get("id") == Some(&json!(3)))
            .and_then(|line| line.get("result")),
        Some(&json!({}))
    );
    assert_eq!(
        archive_lines
            .iter()
            .find(|line| line.get("method") == Some(&json!("thread/archived")))
            .and_then(|line| line.pointer("/params/threadId")),
        Some(&json!(thread_id))
    );
    assert!(!active_path.exists());
    let archived_files = rollout_files(&agent_root.join("archived_sessions"));
    assert_eq!(archived_files.len(), 1);
    assert_eq!(archived_files[0].file_name(), active_path.file_name());

    let active = request(&server, 4, METHOD_THREAD_LIST, json!({"archived": false})).await;
    assert_eq!(active.pointer("/result/data"), Some(&json!([])));
    let archived = request(&server, 5, METHOD_THREAD_LIST, json!({"archived": true})).await;
    assert_eq!(
        archived.pointer("/result/data/0/id"),
        Some(&json!(thread_id))
    );

    let duplicate_archive = request_lines(
        &server,
        6,
        METHOD_THREAD_ARCHIVE,
        json!({"threadId": thread_id}),
    )
    .await;
    assert!(duplicate_archive
        .iter()
        .all(|line| line.get("method") != Some(&json!("thread/archived"))));

    let unarchive_lines = request_lines(
        &server,
        7,
        METHOD_THREAD_UNARCHIVE,
        json!({"threadId": thread_id}),
    )
    .await;
    assert_eq!(
        unarchive_lines
            .iter()
            .find(|line| line.get("id") == Some(&json!(7)))
            .and_then(|line| line.pointer("/result/thread/id")),
        Some(&json!(thread_id))
    );
    assert_eq!(
        unarchive_lines
            .iter()
            .find(|line| line.get("method") == Some(&json!("thread/environment/connected")))
            .and_then(|line| line.pointer("/params/threadId")),
        Some(&json!(thread_id))
    );
    assert_eq!(
        unarchive_lines
            .iter()
            .find(|line| line.get("method") == Some(&json!("thread/environment/connected")))
            .and_then(|line| line.pointer("/params/environmentId")),
        Some(&json!("local"))
    );
    assert_eq!(
        unarchive_lines
            .iter()
            .find(|line| line.get("method") == Some(&json!("thread/unarchived")))
            .and_then(|line| line.pointer("/params/threadId")),
        Some(&json!(thread_id))
    );
    assert!(active_path.exists());
    let bytes = fs::read(&active_path).unwrap();
    let modified = fs::metadata(&active_path).unwrap().modified().unwrap();
    assert_unarchive_rejected(&server, 22, &thread_id).await;
    assert_eq!(fs::read(&active_path).unwrap(), bytes);
    assert_eq!(
        fs::metadata(&active_path).unwrap().modified().unwrap(),
        modified
    );
    assert!(rollout_files(&agent_root.join("archived_sessions")).is_empty());
}
