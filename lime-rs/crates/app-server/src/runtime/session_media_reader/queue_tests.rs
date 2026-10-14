use super::*;
use crate::runtime::sidecar_store::SidecarStore;
use crate::runtime::{EventLogWriter, ProjectionStore, StorageRoots};
use agent_protocol::{AgentInput, ImageDetail};
use app_server_protocol::AgentSessionStartParams;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;

const SESSION_ID: &str = "session-queue-media-read";
const THREAD_ID: &str = "thread-queue-media-read";
const PNG_BASE64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==";

struct QueueMediaFixture {
    _temp: tempfile::TempDir,
    roots: StorageRoots,
    core: RuntimeCore,
}

impl QueueMediaFixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().expect("queue media tempdir");
        let roots = StorageRoots::initialize(temp.path(), temp.path().join("app-server"))
            .expect("queue media roots");
        let core = open_core(&roots);
        start_session(&core, SESSION_ID, THREAD_ID);
        Self {
            _temp: temp,
            roots,
            core,
        }
    }

    async fn add_png(&self) -> crate::runtime::thread_queue::ThreadQueuedSubmission {
        self.core
            .add_thread_queue_submission(
                THREAD_ID,
                image_input(
                    "inspect image",
                    format!("data:image/png;base64,{PNG_BASE64}"),
                ),
                "client-queue-image".to_string(),
            )
            .await
            .expect("queue inline PNG")
    }

    fn output_ref(&self) -> Value {
        self.core
            .events_for_session(SESSION_ID)
            .expect("queue media events")
            .into_iter()
            .find_map(|event| {
                event
                    .payload
                    .get("outputRefs")
                    .and_then(Value::as_array)
                    .and_then(|refs| refs.first())
                    .cloned()
            })
            .expect("verified input media output reference")
    }

    fn mutate_media_payload(&self, mut mutate: impl FnMut(&mut Value)) {
        let mut state = self.core.state.lock().expect("runtime state");
        let events = &mut state
            .sessions
            .get_mut(SESSION_ID)
            .expect("queue media session")
            .events;
        let mut mutated = 0;
        for event in events.iter_mut().filter(|event| {
            event.payload["outputRefs"]
                .as_array()
                .is_some_and(|refs| !refs.is_empty())
        }) {
            mutate(&mut event.payload);
            mutated += 1;
        }
        assert!(mutated > 0, "verified input media event must exist");
    }
}

fn open_core(roots: &StorageRoots) -> RuntimeCore {
    RuntimeCore::default()
        .with_event_log_writer(Arc::new(
            EventLogWriter::new(&roots.event_log_root).expect("queue media event log"),
        ))
        .with_projection_store(Arc::new(
            ProjectionStore::initialize_with_storage_paths(
                &roots.projection_db_path,
                &roots.state_db_path,
                &roots.thread_history_db_path,
                &roots.data_root,
            )
            .expect("queue media projection store"),
        ))
        .with_sidecar_store(Arc::new(
            SidecarStore::new(&roots.sidecar_root).expect("queue media sidecar store"),
        ))
}

fn start_session(core: &RuntimeCore, session_id: &str, thread_id: &str) {
    core.start_session(AgentSessionStartParams {
        session_id: Some(session_id.to_string()),
        thread_id: Some(thread_id.to_string()),
        app_id: "agent-chat".to_string(),
        workspace_id: Some("workspace-current".to_string()),
        business_object_ref: None,
        locale: None,
    })
    .expect("queue media session");
}

fn image_input(text: &str, uri: String) -> Vec<AgentInput> {
    vec![
        AgentInput::text(text),
        AgentInput::Image {
            uri,
            detail: Some(ImageDetail::Original),
        },
        AgentInput::text("then review"),
    ]
}

fn image_uri(input: &[AgentInput]) -> &str {
    match &input[1] {
        AgentInput::Image { uri, detail } => {
            assert_eq!(*detail, Some(ImageDetail::Original));
            uri
        }
        value => panic!("queued image changed shape: {value:?}"),
    }
}

fn read_params(uri: &str) -> MediaReadParams {
    MediaReadParams {
        thread_id: THREAD_ID.to_string(),
        uri: Some(uri.to_string()),
        ref_id: None,
        sidecar_ref: None,
        max_bytes: Some(1024),
        offset: None,
        length: None,
    }
}

fn assert_png(core: &RuntimeCore, uri: &str) {
    let response = core.read_media(read_params(uri)).expect("read queued PNG");
    let bytes = BASE64_STANDARD
        .decode(PNG_BASE64)
        .expect("valid PNG base64");
    assert_eq!(response.uri, uri);
    assert_eq!(response.mime_type.as_deref(), Some("image/png"));
    assert_eq!(response.content_base64, PNG_BASE64);
    assert_eq!(response.bytes, bytes.len() as u64);
    assert_eq!(response.total_bytes, bytes.len() as u64);
    assert!(!response.has_more);
    assert_eq!(
        response.sha256,
        format!("sha256:{}", hex::encode(Sha256::digest(&bytes)))
    );
    let reference = response
        .sidecar_ref
        .expect("verified input media reference");
    assert_eq!(reference["ref"], uri);
    assert_eq!(reference["bytes"], bytes.len());
    assert_eq!(reference["sha256"], response.sha256);
}

#[tokio::test]
async fn queue_added_inline_png_is_readable_by_canonical_uri() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let uri = image_uri(&queued.input);
    assert!(uri.starts_with("sidecar://media/input-"));
    assert_png(&fixture.core, uri);
}

#[tokio::test]
async fn queue_media_uri_and_bytes_survive_edit_reorder_and_cold_restart() {
    let mut fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let uri = image_uri(&queued.input).to_string();
    assert_png(&fixture.core, &uri);

    let edited_input = image_input("edited image request", uri.clone());
    let edited = fixture
        .core
        .update_thread_queue_submission(THREAD_ID, &queued.id, edited_input.clone())
        .await
        .expect("edit image submission");
    assert_eq!(edited.id, queued.id);
    assert_eq!(edited.client_user_message_id, queued.client_user_message_id);
    assert_eq!(edited.input, edited_input);
    assert_png(&fixture.core, &uri);

    let other = fixture
        .core
        .add_thread_queue_submission(
            THREAD_ID,
            vec![AgentInput::text("other queued message")],
            "client-other".to_string(),
        )
        .await
        .expect("add reorder sentinel");
    fixture
        .core
        .reorder_thread_queue_submissions(THREAD_ID, vec![other.id.clone(), queued.id.clone()])
        .await
        .expect("reorder image submission");
    assert_png(&fixture.core, &uri);
    drop(fixture.core);
    fixture.core = open_core(&fixture.roots);
    let restored = fixture
        .core
        .list_thread_queue_submissions(THREAD_ID)
        .await
        .expect("hydrate queue after cold restart");
    assert_eq!(restored.len(), 2);
    assert_eq!(restored[0].id, other.id);
    assert_eq!(restored[1].id, queued.id);
    assert_eq!(restored[1].input, edited_input);
    assert_eq!(image_uri(&restored[1].input), uri);
    assert_png(&fixture.core, &uri);
}

#[tokio::test]
async fn queue_media_range_keeps_verified_digest_and_bounds() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let uri = image_uri(&queued.input);
    let png = BASE64_STANDARD.decode(PNG_BASE64).expect("PNG");
    let mut params = read_params(uri);
    params.offset = Some(1);
    params.length = Some(3);
    params.max_bytes = Some(3);
    let response = fixture.core.read_media(params.clone()).expect("PNG range");
    assert_eq!(response.content_base64, BASE64_STANDARD.encode(&png[1..4]));
    assert_eq!(response.bytes, 3);
    assert_eq!(response.total_bytes, png.len() as u64);
    assert_eq!(response.content_range, format!("bytes 1-3/{}", png.len()));
    assert!(response.has_more);
    assert_eq!(
        response.sha256,
        format!("sha256:{}", hex::encode(Sha256::digest(&png)))
    );

    params.offset = Some(png.len() as u64 + 1);
    let error = fixture
        .core
        .read_media(params.clone())
        .expect_err("offset bound");
    assert!(error.to_string().contains("offset exceeds file size"));
    params.offset = Some(0);
    params.length = Some(4);
    let error = fixture
        .core
        .read_media(params.clone())
        .expect_err("window bound");
    assert!(error.to_string().contains("exceeds read window"));
    params.length = Some(0);
    let error = fixture.core.read_media(params).expect_err("zero length");
    assert!(error.to_string().contains("length must be positive"));
}

#[tokio::test]
async fn queue_media_range_rejects_changed_bytes_outside_requested_window() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let reference = fixture.output_ref();
    let relative_path = reference["relativePath"].as_str().expect("media path");
    let mut png = BASE64_STANDARD.decode(PNG_BASE64).expect("PNG");
    *png.last_mut().expect("PNG content") ^= 1;
    std::fs::write(fixture.roots.sidecar_root.join(relative_path), png)
        .expect("tamper fixture PNG");
    let mut params = read_params(image_uri(&queued.input));
    params.offset = Some(0);
    params.length = Some(4);
    params.max_bytes = Some(4);
    let error = fixture
        .core
        .read_media(params)
        .expect_err("full digest check");
    assert!(error.to_string().contains("校验失败"));
}

#[tokio::test]
async fn queue_media_rejects_unknown_and_cross_thread_references() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let uri = image_uri(&queued.input);
    let mut params = read_params("sidecar://media/unknown.png");
    let error = fixture
        .core
        .read_media(params.clone())
        .expect_err("unknown URI");
    assert!(error.to_string().contains("reference is not available"));

    start_session(&fixture.core, "session-other", "thread-other");
    params.uri = Some(uri.to_string());
    params.thread_id = "thread-other".to_string();
    params.sidecar_ref = Some(fixture.output_ref());
    let error = fixture
        .core
        .read_media(params)
        .expect_err("cross-thread reference");
    assert!(error.to_string().contains("reference is not available"));
}

#[tokio::test]
async fn queue_media_caller_metadata_cannot_override_known_integrity_or_scope() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let uri = image_uri(&queued.input);
    let mut params = read_params(uri);
    params.sidecar_ref = Some(json!({
        "ref": uri,
        "relativePath": "sessions/session-other/media/forged.png",
        "sha256": "sha256:forged",
        "bytes": 0,
        "mimeType": "text/plain",
    }));
    let response = fixture
        .core
        .read_media(params)
        .expect("known metadata wins");
    assert_eq!(response.content_base64, PNG_BASE64);
    assert_eq!(response.mime_type.as_deref(), Some("image/png"));
    assert_eq!(response.sidecar_ref, Some(fixture.output_ref()));
}

#[tokio::test]
async fn queue_media_rejects_known_reference_outside_session_scope() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    fixture.mutate_media_payload(|payload| {
        payload["outputRefs"][0]["relativePath"] = json!("sessions/session-other/media/forged.png");
    });
    let error = fixture
        .core
        .read_media(read_params(image_uri(&queued.input)))
        .expect_err("known path must remain session scoped");
    assert!(error.to_string().contains("outside the requested session"));
}

#[tokio::test]
async fn queue_media_rejects_known_reference_digest_and_size_mismatch() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let reference = fixture.output_ref();
    fixture.mutate_media_payload(|payload| {
        payload["outputRefs"][0]["sha256"] = json!("sha256:forged");
    });
    let error = fixture
        .core
        .read_media(read_params(image_uri(&queued.input)))
        .expect_err("known digest mismatch");
    assert!(error.to_string().contains("校验失败"));
    fixture.mutate_media_payload(|payload| {
        payload["outputRefs"][0]["sha256"] = reference["sha256"].clone();
        payload["outputRefs"][0]["bytes"] = json!(reference["bytes"].as_u64().unwrap() + 1);
    });
    let error = fixture
        .core
        .read_media(read_params(image_uri(&queued.input)))
        .expect_err("known size mismatch");
    assert!(error.to_string().contains("size mismatch"));
}

#[tokio::test]
async fn queue_media_plain_metadata_outside_output_refs_does_not_authorize_read() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    fixture.mutate_media_payload(|payload| {
        let object = payload.as_object_mut().expect("queue payload object");
        let refs = object.remove("outputRefs").expect("output refs");
        object.insert("mediaMetadata".to_string(), refs);
    });
    let error = fixture
        .core
        .read_media(read_params(image_uri(&queued.input)))
        .expect_err("plain metadata is not an authorized media reference");
    assert!(error.to_string().contains("reference is not available"));
}

#[tokio::test]
async fn queue_media_non_media_output_ref_does_not_authorize_read() {
    let fixture = QueueMediaFixture::new();
    fixture.add_png().await;
    let uri = "sidecar://reports/fixture";
    fixture.mutate_media_payload(|payload| {
        let reference = &mut payload["outputRefs"][0];
        reference["ref"] = json!(uri);
        reference["kind"] = json!("report");
        reference["mimeType"] = json!("text/plain");
        reference["relativePath"] = json!(format!("sessions/{SESSION_ID}/reports/fixture.bin"));
    });
    let error = fixture
        .core
        .read_media(read_params(uri))
        .expect_err("non-media ref");
    assert!(error.to_string().contains("reference is not available"));
}

#[tokio::test]
async fn queue_media_read_still_observes_cancellation() {
    let fixture = QueueMediaFixture::new();
    let queued = fixture.add_png().await;
    let error = fixture
        .core
        .read_media_with_cancel(read_params(image_uri(&queued.input)), || true)
        .expect_err("canceled queued media read");
    assert!(matches!(error, RuntimeCoreError::RequestCanceled));
    assert_png(&fixture.core, image_uri(&queued.input));
}
