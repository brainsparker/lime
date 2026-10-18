use super::super::history::{assert_normalized, assert_prompt_only, injected_items};
use super::*;
use app_server::{EventLogWriter, StorageRoots};

#[tokio::test]
async fn real_stdio_tool_history_is_prompt_only_and_stable_after_process_restart() {
    let temp = TempDir::new().unwrap();
    let binary = fixed_binary();
    let fixture = ModelFixture::start(Wire::Responses).await;
    let mut peer = Peer::start(temp.path(), &binary).await;
    let provider = peer.provision(&fixture).await;
    let started = peer
        .rpc(
            "thread/start",
            json!({
                "cwd":temp.path(),"model":fixture.wire.model(),"modelProvider":provider,
            }),
        )
        .await;
    let thread = started["thread"]["id"].as_str().unwrap();
    let session = started["thread"]["sessionId"].as_str().unwrap();
    let original = injected_items();
    peer.rpc(
        "thread/inject_items",
        json!({"threadId":thread,"items":original}),
    )
    .await;
    peer.rpc(
        "turn/start",
        json!({"threadId":thread,"input":[{"type":"text","text":"resume inherited calls"}]}),
    )
    .await;
    peer.completed().await;
    let outputs = assert_normalized(&fixture.last_request(), &original);
    peer.close().await;

    let roots = StorageRoots::from_roots(temp.path().join("app"), temp.path().join("agent"));
    let log = EventLogWriter::new(&roots.event_log_root).unwrap();
    assert_prompt_only(&log, session, &original);
    let mut reopened = Peer::start(temp.path(), &binary).await;
    reopened
        .rpc("thread/resume", json!({"threadId":thread}))
        .await;
    reopened.rpc("turn/start", json!({"threadId":thread,"input":[{"type":"text","text":"continue after process restart"}]})).await;
    reopened.completed().await;
    assert_eq!(
        assert_normalized(&fixture.last_request(), &original),
        outputs
    );
    reopened
        .rpc("thread/compact/start", json!({"threadId":thread}))
        .await;
    reopened.completed().await;
    assert_eq!(
        assert_normalized(&fixture.last_request(), &original),
        outputs
    );
    reopened.close().await;
    assert_prompt_only(&log, session, &original);
}
