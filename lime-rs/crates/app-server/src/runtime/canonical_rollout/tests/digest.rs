use super::*;

fn legacy_rollout() -> (tempfile::TempDir, RolloutStore, PathBuf, PathBuf) {
    let temp = tempfile::tempdir().expect("tempdir");
    let store = RolloutStore::new(temp.path());
    let relative = PathBuf::from("sessions/2023/11/14/rollout-legacy-order.jsonl");
    let absolute = temp.path().join(&relative);
    fs::create_dir_all(absolute.parent().unwrap()).expect("rollout directory");
    // Sanitized CLI/App Server v1 writer output; keep the hashed payload's field order.
    fs::write(&absolute, include_str!("legacy-order.jsonl")).expect("legacy rollout");
    (temp, store, relative, absolute)
}

#[test]
fn legacy_object_order_survives_scan_metadata_update_and_history_append() {
    let (_temp, store, relative, absolute) = legacy_rollout();
    let scan =
        scan_rollout(&absolute).expect("read legacy CLI writer independently of Cargo features");
    assert_eq!(scan.history.len(), 1);
    assert_eq!(scan.history[0].changes.changed_items.len(), 1);
    let source = scan.initial_thread;
    let mut next = source.clone();
    next.updated_at_ms += 1;
    next.metadata["approvalsReviewer"] = json!("auto_review");
    store
        .append_metadata(&relative, &source, &next, false)
        .expect("append current metadata");
    append(&store, &relative, &source, 6, &fingerprint('a')).expect("append current history");
    let reopened = scan_rollout(&absolute).expect("read mixed legacy/current records");
    assert_eq!(reopened.initial_thread.metadata, next.metadata);
    assert_eq!(reopened.history.len(), 2);
}

#[test]
fn legacy_digest_still_rejects_modified_payload() {
    let (_temp, _store, _relative, absolute) = legacy_rollout();
    let text = fs::read_to_string(&absolute).unwrap();
    fs::write(
        &absolute,
        text.replace(
            "Preserve the imported reviewer setting.",
            "modified payload",
        ),
    )
    .unwrap();
    assert!(scan_rollout(&absolute)
        .unwrap_err()
        .contains("invalid rollout history record"));
}

#[test]
fn legacy_metadata_chain_still_rejects_modified_content_or_predecessor() {
    for (original, replacement) in [
        (
            "\"legacyOrderProbe\":{\"z\":0",
            "\"legacyOrderProbe\":{\"z\":1",
        ),
        (
            "\"previous_content_digest\":\"",
            "\"previous_content_digest\":\"0",
        ),
    ] {
        let (_temp, _store, _relative, absolute) = legacy_rollout();
        let text = fs::read_to_string(&absolute).unwrap();
        let modified = text.replace(original, replacement);
        assert_ne!(modified, text);
        fs::write(&absolute, modified).unwrap();
        assert!(scan_rollout(&absolute)
            .unwrap_err()
            .contains("invalid rollout metadata record"));
    }
}

#[test]
fn current_digest_matches_fixed_sorted_vectors_in_every_feature_build() {
    assert_eq!(
        super::super::digest::history_content_digest("session", "thread", &changes(7)).unwrap(),
        "08550c69b59eea0961765fa40009ad2139df938a56a429309c5f98783d61306a"
    );
    let metadata: Value =
        serde_json::from_str(r#"{"z":{"y":1,"b":2},"a":[{"z":18446744073709551615,"a":"中"}]}"#)
            .unwrap();
    assert_eq!(
        super::super::digest::metadata_content_digest("session", "thread", 7, &metadata).unwrap(),
        "a09a614ac3a8f8dca7aef6a3e30f4516e71c16e61ddd6b47e6e3114d0b03a80a"
    );
}

#[test]
fn current_records_accept_object_reordering_but_reject_content_changes() {
    let (_temp, store, source, relative, absolute) = setup("stable-digest");
    append(&store, &relative, &source, 1, &fingerprint('a')).unwrap();
    let mut next = source.clone();
    next.updated_at_ms += 1;
    next.metadata = serde_json::from_str(r#"{"z":1,"a":{"y":2,"b":3}}"#).unwrap();
    store
        .append_metadata(&relative, &source, &next, false)
        .unwrap();
    let records = fs::read_to_string(&absolute).unwrap();
    let reordered = records
        .lines()
        .map(|line| {
            let mut record: Value = serde_json::from_str(line).unwrap();
            assert_eq!(record["schema_version"], 2);
            record.sort_all_objects();
            serde_json::to_string(&record).unwrap() + "\n"
        })
        .collect::<String>();
    fs::write(&absolute, &reordered).unwrap();
    assert_eq!(
        scan_rollout(&absolute).unwrap().initial_thread.metadata,
        next.metadata
    );
    fs::write(&absolute, reordered.replace("\"z\":1", "\"z\":9")).unwrap();
    assert!(scan_rollout(&absolute)
        .unwrap_err()
        .contains("invalid rollout metadata record"));
}
