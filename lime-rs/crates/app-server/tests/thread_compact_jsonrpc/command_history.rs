use super::*;
use model_fixture::Capture;

const COMMAND: &str = "printf 'CMD-READY\\n'; IFS= read -r first; printf 'CMD-FIRST:%s\\n' \"$first\"; IFS= read -r second; printf 'CMD-SECOND:%s\\n' \"$second\"";

fn session_id(value: &Value) -> Option<i64> {
    match value {
        Value::Object(object) => object
            .get("session_id")
            .and_then(Value::as_i64)
            .or_else(|| object.values().find_map(session_id)),
        Value::Array(values) => values.iter().find_map(session_id),
        Value::String(text) => serde_json::from_str::<Value>(text)
            .ok()
            .as_ref()
            .and_then(session_id),
        _ => None,
    }
}

fn script() -> impl FnMut(&Capture) -> Option<(String, String, Value)> + Send {
    let mut step = 0;
    move |capture| {
        let invocation = match step {
            0 => Some((
                "command-exec",
                "exec_command",
                json!({
                    "cmd": COMMAND, "shell":"/bin/sh", "login":false,
                    "yield_time_ms":250, "max_output_tokens":2048,
                }),
            )),
            1 | 2 => {
                let id = session_id(capture.history()).unwrap_or_else(|| {
                    panic!(
                        "real exec_command must return an interactive session: {}",
                        capture.history()
                    )
                });
                Some((
                    if step == 1 {
                        "command-write-1"
                    } else {
                        "command-write-2"
                    },
                    "write_stdin",
                    json!({
                        "session_id":id, "chars":if step == 1 {"first-value\n"} else {"second-value\n"},
                        "yield_time_ms":250, "max_output_tokens":2048,
                    }),
                ))
            }
            _ => None,
        };
        step += 1;
        invocation.map(|(id, name, args)| (id.to_string(), name.to_string(), args))
    }
}

// Compare canonical invocation semantics across native wire shapes. Gemini's wire
// may omit call ids, so identity assertions belong at the durable runtime boundary.
fn invocations(capture: &Capture, wire: Wire) -> Vec<Value> {
    let body = capture.body.to_string();
    for internal in [
        "history_token_limit",
        "outputTokenLimits",
        "provider.model_history",
    ] {
        assert!(
            !body.contains(internal),
            "host history metadata leaked to provider wire"
        );
    }
    let mut entries = Vec::new();
    for message in capture.history().as_array().expect("wire history array") {
        match wire {
            Wire::Chat => {
                if let Some(calls) = message.get("tool_calls").and_then(Value::as_array) {
                    for call in calls {
                        entries.push(json!({"kind":"call", "name":call["function"]["name"],
                            "arguments":serde_json::from_str::<Value>(call["function"]["arguments"].as_str().unwrap()).unwrap()}));
                    }
                }
                if message["role"] == "tool" {
                    entries.push(json!({"kind":"result", "output":message["content"]}));
                }
            }
            Wire::Responses => match message["type"].as_str() {
                Some("function_call") => entries.push(json!({"kind":"call", "name":message["name"],
                    "arguments":serde_json::from_str::<Value>(message["arguments"].as_str().unwrap()).unwrap()})),
                Some("function_call_output") => entries.push(json!({"kind":"result", "output":message["output"]})),
                _ => {}
            },
            Wire::Anthropic => {
                for part in message.get("content").and_then(Value::as_array).into_iter().flatten() {
                    match part["type"].as_str() {
                        Some("tool_use") => entries.push(json!({"kind":"call", "name":part["name"], "arguments":part["input"]})),
                        Some("tool_result") => entries.push(json!({"kind":"result", "output":part["content"]})),
                        _ => {}
                    }
                }
            }
            Wire::Gemini => {
                for part in message.get("parts").and_then(Value::as_array).into_iter().flatten() {
                    if let Some(call) = part.get("functionCall") {
                        entries.push(json!({"kind":"call", "name":call["name"], "arguments":call["args"]}));
                    }
                    if let Some(result) = part.get("functionResponse") {
                        entries.push(json!({"kind":"result", "output":result["response"]["content"]}));
                    }
                }
            }
        }
    }
    entries
}

async fn command_history(wire: Wire) {
    let temp = TempDir::new().unwrap();
    let fixture = ModelFixture::start_with_script(
        wire,
        catalog_truncation::model_catalog_with_budget(
            wire,
            agent_protocol::truncation::TruncationPolicy::Tokens(10000),
        ),
        script(),
    )
    .await;
    let server = AppServer::with_runtime(catalog_truncation::runtime(&temp).await);
    initialize_server(&server).await;
    let provider = catalog_truncation::provision_with_budget(
        &server,
        &fixture,
        20,
        agent_protocol::truncation::TruncationPolicy::Tokens(10000),
    )
    .await;
    let started = request(
        &server,
        2,
        METHOD_THREAD_START,
        json!({
            "model":wire.model(), "modelProvider":provider, "cwd":temp.path(),
            "approvalPolicy":"never", "sandbox":"danger-full-access",
        }),
    )
    .await;
    let thread = started["result"]["thread"]["id"].as_str().unwrap();
    let session = started["result"]["thread"]["sessionId"].as_str().unwrap();
    let mut notifications = server.subscribe_outbound_messages();
    run_turn(
        &server,
        3,
        thread,
        "run the interactive command and send both lines",
    )
    .await;
    let expected = invocations(&fixture.last_request(), wire);
    while let Ok(notification) = notifications.try_recv() {
        assert!(
            !serde_json::to_string(&notification)
                .unwrap()
                .contains("provider.model_history"),
            "internal history cannot be broadcast to GUI"
        );
    }
    let records = EventLogWriter::new(temp.path().join("events"))
        .unwrap()
        .read_session_events(session)
        .unwrap();
    let history = records
        .iter()
        .filter(|record| {
            record.event.event_type == agent_runtime::model_history::MODEL_HISTORY_EVENT_TYPE
        })
        .map(|record| {
            serde_json::from_value::<agent_runtime::model_history::ModelHistoryRecord>(
                record.event.payload.clone(),
            )
            .unwrap()
            .into_message()
            .unwrap()
        })
        .collect::<Vec<_>>();
    assert_eq!(
        history.len(),
        6,
        "each model invocation/output must persist separately"
    );
    let call_ids = history
        .iter()
        .flat_map(|message| &message.content)
        .filter_map(|part| {
            if let model_provider::current_client::CurrentProviderContent::ToolCall(call) = part {
                Some(call.id.as_str())
            } else {
                None
            }
        })
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(
        call_ids.len(),
        3,
        "each invocation needs a distinct identity"
    );
    let read = request(
        &server,
        4,
        "thread/read",
        json!({"threadId":thread,"includeTurns":true}),
    )
    .await;
    let items = read["result"]["thread"]["turns"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|turn| turn["items"].as_array().unwrap())
        .collect::<Vec<_>>();
    let commands = items
        .iter()
        .filter(|item| item["type"] == "commandExecution")
        .collect::<Vec<_>>();
    assert_eq!(
        commands.len(),
        1,
        "three model invocations still project as one command"
    );
    let output = commands[0]["aggregatedOutput"].as_str().unwrap();
    for text in [
        "CMD-READY",
        "CMD-FIRST:first-value",
        "CMD-SECOND:second-value",
    ] {
        assert!(
            output.contains(text),
            "command projection lost output: {output}"
        );
    }
    assert_eq!(
        expected.len(),
        6,
        "three distinct calls and outputs: {expected:?}"
    );
    assert_eq!(expected[0]["name"], "exec_command");
    assert_eq!(expected[2]["name"], "write_stdin");
    assert_eq!(expected[4]["name"], "write_stdin");
    let outputs = [1, 3, 5].map(|index| {
        serde_json::from_str::<Value>(expected[index]["output"].as_str().unwrap())
            .expect("structured command result")
    });
    // A yield can return before stdout is ready; later writes drain the same
    // process. Preserve the exact ordered bytes without pinning chunk timing.
    let stdout = outputs
        .iter()
        .map(|result| result["output"].as_str().unwrap())
        .collect::<String>();
    assert_eq!(
        stdout,
        "CMD-READY\nCMD-FIRST:first-value\nCMD-SECOND:second-value\n",
        "{expected:?}"
    );
    assert_eq!(output, stdout, "projection and model history must agree");
    assert_eq!(outputs[0]["session_id"], outputs[1]["session_id"]);
    assert_eq!(outputs[2]["exit_code"], 0);
    drop(server);

    let server = AppServer::with_runtime(catalog_truncation::runtime(&temp).await);
    initialize_server(&server).await;
    request(
        &server,
        10,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    run_turn(&server, 11, thread, "continue after a cold reopen").await;
    assert_eq!(
        invocations(&fixture.last_request(), wire),
        expected,
        "cold reopen lost model invocations"
    );

    let switches = [
        catalog_truncation::default_budget_fixture(Wire::Chat).await,
        catalog_truncation::default_budget_fixture(Wire::Responses).await,
        catalog_truncation::default_budget_fixture(Wire::Anthropic).await,
        catalog_truncation::default_budget_fixture(Wire::Gemini).await,
    ];
    for (index, next) in switches.iter().enumerate() {
        let id = 30 + index as u64 * 10;
        let provider = catalog_truncation::provision_with_budget(
            &server,
            next,
            id,
            agent_protocol::truncation::TruncationPolicy::Tokens(10000),
        )
        .await;
        request(
            &server,
            id + 4,
            "thread/settings/update",
            json!({
                "threadId":thread,"model":next.wire.model(),"modelProvider":provider,
            }),
        )
        .await;
        run_turn(
            &server,
            id + 5,
            thread,
            "retain each original command invocation after model switch",
        )
        .await;
        next.last_request().assert_route(next.wire);
        assert_eq!(
            invocations(&next.last_request(), next.wire),
            expected,
            "cross-protocol replay lost command history"
        );
    }
    let final_fixture = &switches[3];
    let forked = request(&server, 12, "thread/fork", json!({"threadId":thread})).await;
    let fork = forked["result"]["thread"]["id"].as_str().unwrap();
    run_turn(
        &server,
        13,
        fork,
        "continue from the inherited command history",
    )
    .await;
    assert_eq!(
        invocations(&final_fixture.last_request(), final_fixture.wire),
        expected,
        "fork lost model invocations"
    );
    drop(server);
    let server = AppServer::with_runtime(catalog_truncation::runtime(&temp).await);
    initialize_server(&server).await;
    request(&server, 70, METHOD_THREAD_RESUME, json!({"threadId":fork})).await;
    run_turn(
        &server,
        71,
        fork,
        "resume inherited history after cold reopen",
    )
    .await;
    assert_eq!(
        invocations(&final_fixture.last_request(), final_fixture.wire),
        expected,
        "cold fork lost model invocations"
    );
    request(
        &server,
        72,
        METHOD_THREAD_RESUME,
        json!({"threadId":thread}),
    )
    .await;
    assert_eq!(
        compact(&server, 14, thread).await["params"]["turn"]["status"],
        "completed"
    );
    assert_eq!(
        invocations(&final_fixture.last_request(), final_fixture.wire),
        expected,
        "summary lost model invocations"
    );
}

#[tokio::test]
async fn command_history_chat_survives_cold_reopen_fork_and_summary() {
    command_history(Wire::Chat).await;
}

#[tokio::test]
async fn command_history_responses_survives_cold_reopen_fork_and_summary() {
    command_history(Wire::Responses).await;
}

#[tokio::test]
async fn command_history_anthropic_survives_cold_reopen_fork_and_summary() {
    command_history(Wire::Anthropic).await;
}

#[tokio::test]
async fn command_history_gemini_survives_cold_reopen_fork_and_summary() {
    command_history(Wire::Gemini).await;
}
