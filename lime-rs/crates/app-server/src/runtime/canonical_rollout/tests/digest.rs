use super::*;

#[test]
fn obsolete_schema_is_rejected_without_migration() {
    for version in [1, 2] {
        let (_temp, _store, _source, _relative, absolute) = setup("obsolete-schema");
        let mut header: Value =
            serde_json::from_str(&fs::read_to_string(&absolute).unwrap()).unwrap();
        header["schema_version"] = json!(version);
        fs::write(&absolute, serde_json::to_string(&header).unwrap() + "\n").unwrap();
        assert!(scan_rollout(&absolute)
            .unwrap_err()
            .contains("unsupported rollout schema version"));
    }
}

#[test]
fn current_digest_matches_fixed_sorted_vectors_in_every_feature_build() {
    assert_eq!(
        super::super::digest::history_content_digest("session", "thread", &changes(7), &[])
            .unwrap(),
        "fff56909a3f75793980251e389f0187d7efd55d20fb03946095be7f169fa058e"
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
            assert_eq!(record["schema_version"], 3);
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
