use super::*;
use ephemeral::{files, start_and_complete};
use sha2::{Digest, Sha256};

fn history_digest(record: &mut Value) {
    let mut payload = json!([
        record["session_id"],
        record["thread_id"],
        record["changes"],
        record["runtime_events"]
    ]);
    payload.sort_all_objects();
    record["content_digest"] = json!(hex::encode(Sha256::digest(
        serde_json::to_vec(&payload).unwrap()
    )));
}

#[tokio::test]
async fn malformed_standalone_history_is_rejected_before_target_creation() {
    let source = TempDir::new().unwrap();
    let destination = TempDir::new().unwrap();
    let db = source.path().join("projection.sqlite");
    let root = source.path().join("agent");
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(&db, &root).unwrap(),
        )),
    );
    initialize(&server, 1).await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({"cwd":source.path(),"model":"fixture-model","modelProvider":"fixture-provider"}),
    )
    .await;
    let id = required_string(&started, "/result/thread/id");
    start_and_complete(
        &server,
        &id,
        json!([{"type":"text","text":"integrity source"}]),
    )
    .await;
    let relative: String = Connection::open(&db)
        .unwrap()
        .query_row(
            "SELECT rollout_path FROM canonical_threads WHERE thread_id=?1",
            [&id],
            |row| row.get(0),
        )
        .unwrap();
    let records = std::fs::read_to_string(root.join(relative))
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str::<Value>(line).unwrap())
        .collect::<Vec<_>>();
    let reader = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(ImmediateBackend)).with_projection_store(Arc::new(
            ProjectionStore::initialize_with_agent_root(
                destination.path().join("projection.sqlite"),
                destination.path().join("agent"),
            )
            .unwrap(),
        )),
    );
    initialize(&reader, 3).await;
    for scenario in [
        "missing-events",
        "digest",
        "identity",
        "sequence",
        "model-record",
        "schema-1",
        "schema-2",
    ] {
        let mut modified = records.clone();
        let history = modified
            .iter_mut()
            .find(|record| {
                record["type"] == "thread_history"
                    && !record["runtime_events"].as_array().unwrap().is_empty()
            })
            .unwrap();
        match scenario {
            "missing-events" => {
                history.as_object_mut().unwrap().remove("runtime_events");
            }
            "digest" => {
                history["runtime_events"][0]["payload"] = json!({"changed":true});
            }
            "identity" => {
                history["runtime_events"][0]["sessionId"] = json!("wrong-session");
                history_digest(history);
            }
            "sequence" => {
                history["runtime_events"][0]["sequence"] = json!(0);
                history_digest(history);
            }
            "model-record" => {
                history["runtime_events"][0]["type"] = json!("provider.model_history");
                history["runtime_events"][0]["payload"] = json!({});
                history_digest(history);
            }
            "schema-1" => modified[0]["schema_version"] = json!(1),
            "schema-2" => modified[0]["schema_version"] = json!(2),
            _ => unreachable!(),
        }
        let path = destination.path().join(format!("{scenario}.jsonl"));
        let bytes = modified
            .iter()
            .map(|record| serde_json::to_string(record).unwrap() + "\n")
            .collect::<String>();
        std::fs::write(&path, &bytes).unwrap();
        let before = files(destination.path());
        let error = request_error(
            &reader,
            4,
            METHOD_THREAD_FORK,
            json!({"threadId":"","path":path}),
        )
        .await;
        assert_eq!(
            error["error"]["code"],
            error_codes::INVALID_REQUEST,
            "{scenario}: {error}"
        );
        assert_eq!(
            files(destination.path()),
            before,
            "{scenario} created artifacts"
        );
        assert_eq!(std::fs::read_to_string(&path).unwrap(), bytes);
        let count: i64 = Connection::open(destination.path().join("projection.sqlite"))
            .unwrap()
            .query_row("SELECT COUNT(*) FROM canonical_threads", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0, "{scenario} created a target");
    }
}
