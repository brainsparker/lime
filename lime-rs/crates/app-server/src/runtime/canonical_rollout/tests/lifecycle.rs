use super::*;

#[test]
fn metadata_uses_record_revision_independently_of_file_time_and_rejects_conflicts() {
    let (_temp, store, source, relative, path) = setup("lifecycle-metadata");
    let mut expected = source.clone();
    expected.updated_at_ms += 100;
    let mut next = expected.clone();
    next.metadata = json!({"modelName": "model-b"});
    next.updated_at_ms += 1;
    let before = fs::read(&path).unwrap();
    let time = std::time::UNIX_EPOCH
        + std::time::Duration::from_millis(expected.updated_at_ms as u64 + 500);
    fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap()
        .set_times(fs::FileTimes::new().set_modified(time))
        .unwrap();
    let mut conflicting = expected.clone();
    conflicting.metadata = json!({"modelName": "uncommitted"});
    assert!(store
        .append_metadata(&relative, &conflicting, &next, false)
        .unwrap_err()
        .contains("metadata state conflict"));
    assert_eq!(fs::read(&path).unwrap(), before);
    let mut backwards = next.clone();
    backwards.updated_at_ms = expected.updated_at_ms - 1;
    assert!(store
        .append_metadata(&relative, &expected, &backwards, false)
        .unwrap_err()
        .contains("timestamp moved backwards"));
    assert_eq!(fs::read(&path).unwrap(), before);
    store
        .append_metadata(&relative, &expected, &next, false)
        .unwrap();
    assert_eq!(
        scan_rollout(&path).unwrap().initial_thread.metadata,
        next.metadata
    );
    assert_eq!(
        scan_rollout(&path).unwrap().initial_thread.updated_at_ms,
        next.updated_at_ms
    );
    let saved = fs::read(&path).unwrap();
    let mut divergent = next.clone();
    divergent.metadata = json!({"modelName": "must-not-overwrite"});
    divergent.updated_at_ms += 1;
    assert!(store
        .append_metadata(&relative, &expected, &divergent, false)
        .unwrap_err()
        .contains("metadata state conflict"));
    assert_eq!(fs::read(&path).unwrap(), saved);
}
