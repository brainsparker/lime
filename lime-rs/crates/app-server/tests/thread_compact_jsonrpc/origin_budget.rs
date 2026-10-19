use super::*;
use agent_protocol::truncation::{TruncationPolicy, HISTORY_TOKEN_LIMIT_KEY};
use catalog_truncation::{fixture, provision, runtime};
use history_truncation::contains_text;

const ORIGINAL_TOOL_NAME: &str = " read_file ";

fn saved_result(temp: &TempDir, session: &str) -> Value {
    EventLogWriter::new(temp.path().join("events"))
        .unwrap()
        .read_session_events(session)
        .unwrap()
        .into_iter()
        .filter(|record| record.event.event_type == "item.completed")
        .find_map(|record| {
            let item = record.event.payload.get("item")?.clone();
            (item["payload"]["name"] == "Read").then_some(item)
        })
        .expect("real Read execution must persist a canonical completed tool item")
}

async fn assert_projection(temp: &TempDir, thread: &str, original: &Value, stage: &str) {
    let store = ProjectionStore::initialize(temp.path().join("projection.sqlite")).unwrap();
    let snapshot = thread_store::ThreadStore::read_thread(
        &store,
        thread_store::ReadThreadParams {
            thread_id: agent_protocol::ThreadId::new(thread),
            include_archived: false,
            turns_view: agent_protocol::ThreadTurnsView::Full,
        },
    )
    .await
    .unwrap()
    .unwrap();
    let items = snapshot
        .turns
        .iter()
        .flat_map(|turn| &turn.items)
        .collect::<Vec<_>>();
    let item = items
        .iter()
        .find(|item| item.item_id.as_str() == original["itemId"].as_str().unwrap());
    assert!(
        item.is_some(),
        "{stage}: tool item missing from canonical projection: {items:?}"
    );
    let item = serde_json::to_value(item.unwrap()).unwrap();
    assert_eq!(
        item["payload"], original["payload"],
        "{stage}: tool payload changed"
    );
    assert_eq!(
        item["metadata"], original["metadata"],
        "{stage}: tool metadata changed"
    );
}

fn assert_request(
    fixture: &ModelFixture,
    original: &str,
    limit: usize,
    raw_arguments: &str,
    stage: &str,
) {
    let captured = fixture.last_request();
    let model_call = captured
        .history()
        .as_array()
        .unwrap()
        .iter()
        .find_map(|message| match fixture.wire {
            Wire::Chat => message.get("tool_calls")?.as_array()?.first().map(|call| {
                assert_eq!(
                    call["function"]["arguments"], raw_arguments,
                    "{stage}: raw model arguments were re-encoded"
                );
                (
                    call["function"]["name"].clone(),
                    serde_json::from_str::<Value>(call["function"]["arguments"].as_str().unwrap())
                        .unwrap(),
                )
            }),
            Wire::Responses if message["type"] == "function_call" => {
                assert_eq!(
                    message["arguments"], raw_arguments,
                    "{stage}: raw model arguments were re-encoded"
                );
                Some((
                    message["name"].clone(),
                    serde_json::from_str::<Value>(message["arguments"].as_str().unwrap()).unwrap(),
                ))
            }
            Wire::Anthropic => message.get("content")?.as_array()?.iter().find_map(|part| {
                (part["type"] == "tool_use").then(|| (part["name"].clone(), part["input"].clone()))
            }),
            Wire::Gemini => message.get("parts")?.as_array()?.iter().find_map(|part| {
                let call = part.get("functionCall")?;
                Some((call["name"].clone(), call["args"].clone()))
            }),
            _ => None,
        })
        .expect("original model tool call");
    assert_eq!(
        model_call.0, ORIGINAL_TOOL_NAME,
        "{stage}: model call name was rewritten"
    );
    assert_eq!(
        model_call.1,
        json!({"file_path":" source.txt "}),
        "{stage}: execution repair replaced model arguments"
    );
    if matches!(fixture.wire, Wire::Gemini) {
        let result = captured
            .history()
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|message| message["parts"].as_array().into_iter().flatten())
            .find_map(|part| part.get("functionResponse"))
            .expect("Gemini tool result");
        assert_eq!(
            result["name"], ORIGINAL_TOOL_NAME,
            "{stage}: result name must match model call"
        );
    }
    let expected =
        tool_runtime::tool_io::truncate_tool_output(original, TruncationPolicy::Tokens(limit));
    assert!(
        contains_text(captured.history(), &expected),
        "{:?} {stage}: lost originating budget; expected {expected:?}; history {}",
        fixture.wire,
        captured.history()
    );
    assert!(!captured.body.to_string().contains(HISTORY_TOKEN_LIMIT_KEY));
    assert!(!captured
        .history()
        .to_string()
        .contains("MIDDLE-MUST-NOT-REACH-MODEL"));
}

async fn originating_budget(wire: Wire, expected_limit: usize) {
    let temp = TempDir::new().unwrap();
    let source = format!(
        "HEAD-KEEP{}MIDDLE-MUST-NOT-REACH-MODEL{}TAIL-KEEP",
        "abcdef".repeat(800),
        "甲乙".repeat(800)
    );
    std::fs::write(temp.path().join("source.txt"), &source).unwrap();
    let arguments = json!({"file_path":" source.txt "});
    let raw_arguments = if matches!(wire, Wire::Gemini) {
        arguments.to_string()
    } else {
        serde_json::to_string_pretty(&arguments).unwrap()
    };
    let origin = ModelFixture::start_with_catalog_and_tool(
        wire,
        catalog_truncation::model_catalog_with_budget(wire, catalog_truncation::budget(wire)),
        ORIGINAL_TOOL_NAME,
        arguments,
    )
    .await;
    let server = AppServer::with_runtime(runtime(&temp).await);
    initialize_server(&server).await;
    let provider = provision(&server, &origin, 10).await;
    let started = request(
        &server,
        20,
        METHOD_THREAD_START,
        json!({
            "model":wire.model(),"modelProvider":provider,"cwd":temp.path(),
            "approvalPolicy":"never","sandbox":"workspace-write"
        }),
    )
    .await;
    assert!(started.get("error").is_none(), "{started}");
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    run_turn(&server, 21, thread, "read source.txt with the Read tool").await;
    let item = saved_result(&temp, session);
    assert_eq!(item["status"], "completed", "{item}");
    assert_eq!(item["metadata"][HISTORY_TOKEN_LIMIT_KEY], expected_limit);
    let original = item["payload"]["output"]["text"].as_str().unwrap();
    assert!(original.contains("HEAD-KEEP") && original.contains("TAIL-KEEP"));
    assert!(original.contains("MIDDLE-MUST-NOT-REACH-MODEL"));
    assert_projection(&temp, thread, &item, "after execution").await;
    assert_request(
        &origin,
        original,
        expected_limit,
        &raw_arguments,
        "continuation",
    );
    drop(server);

    let server = AppServer::with_runtime(runtime(&temp).await);
    initialize_server(&server).await;
    let resumed = request(
        &server,
        30,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    assert!(resumed.get("error").is_none(), "{resumed}");
    assert_projection(&temp, thread, &item, "after resume").await;
    let switches = [
        fixture(Wire::Chat).await,
        fixture(Wire::Responses).await,
        fixture(Wire::Anthropic).await,
        fixture(Wire::Gemini).await,
    ];
    for (index, next) in switches.iter().enumerate() {
        let id = 40 + index as u64 * 10;
        let provider = provision(&server, next, id).await;
        let changed = request(
            &server,
            id + 4,
            "thread/settings/update",
            json!({
                "threadId":thread,"model":next.wire.model(),"modelProvider":provider
            }),
        )
        .await;
        assert!(changed.get("error").is_none(), "{changed}");
        run_turn(
            &server,
            id + 5,
            thread,
            "keep the original tool history budget",
        )
        .await;
        next.last_request().assert_route(next.wire);
        assert_request(
            next,
            original,
            expected_limit,
            &raw_arguments,
            "cold model switch",
        );
    }

    assert_projection(&temp, thread, &item, "before fork").await;
    let forked = request(&server, 90, "thread/fork", json!({"threadId":thread})).await;
    assert!(forked.get("error").is_none(), "{forked}");
    let fork_id = forked["result"]["thread"]["id"].as_str().unwrap();
    assert_projection(&temp, fork_id, &item, "fork projection").await;
    run_turn(&server, 91, fork_id, "keep the inherited tool budget").await;
    assert_request(
        &switches[3],
        original,
        expected_limit,
        &raw_arguments,
        "fork",
    );
    assert_eq!(
        compact(&server, 92, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_request(
        &switches[3],
        original,
        expected_limit,
        &raw_arguments,
        "summary",
    );
    assert_eq!(
        saved_result(&temp, session),
        item,
        "sampling, fork and summary cannot rewrite durable originals"
    );
}

#[tokio::test]
async fn origin_budget_chat_survives_cold_switch_fork_and_summary() {
    originating_budget(Wire::Chat, 29).await;
}

#[tokio::test]
async fn origin_budget_responses_survives_cold_switch_fork_and_summary() {
    originating_budget(Wire::Responses, 77).await;
}

#[tokio::test]
async fn origin_budget_anthropic_zero_survives_cold_switch_fork_and_summary() {
    originating_budget(Wire::Anthropic, 0).await;
}

#[tokio::test]
async fn origin_budget_gemini_survives_cold_switch_fork_and_summary() {
    originating_budget(Wire::Gemini, 154).await;
}
