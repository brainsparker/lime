//! Safe imported-item provenance projected at the shared protocol boundary.

use super::*;

pub(super) fn project_item_metadata(metadata: &Value) -> Option<v2::ThreadItemMetadata> {
    if metadata_bool(metadata, &["imported"]) != Some(true) {
        return None;
    }

    let raw_provenance = metadata
        .get("sourceProvenance")
        .or_else(|| metadata.get("source_provenance"));
    let provenance = raw_provenance.and_then(project_item_source_provenance);

    let projected = v2::ThreadItemMetadata {
        imported: metadata_bool(metadata, &["imported"]),
        imported_read_only: metadata_bool(metadata, &["importedReadOnly", "imported_read_only"]),
        imported_synthetic: metadata_bool(metadata, &["importedSynthetic", "imported_synthetic"]),
        imported_incomplete: metadata_bool(
            metadata,
            &["importedIncomplete", "imported_incomplete"],
        ),
        imported_synthetic_id: metadata_bool(
            metadata,
            &["importedSyntheticId", "imported_synthetic_id"],
        ),
        source_client: metadata_string(metadata, &["sourceClient", "source_client"]).or_else(
            || {
                raw_provenance
                    .and_then(|value| metadata_string(value, &["sourceClient", "source_client"]))
            },
        ),
        source_thread_id: metadata_string(metadata, &["sourceThreadId", "source_thread_id"])
            .or_else(|| {
                raw_provenance.and_then(|value| {
                    metadata_string(value, &["sourceThreadId", "source_thread_id"])
                })
            }),
        source_event_type: metadata_string(metadata, &["sourceEventType", "source_event_type"])
            .or_else(|| {
                raw_provenance.and_then(|value| {
                    metadata_string(
                        value,
                        &[
                            "sourceEventType",
                            "source_event_type",
                            "sourcePayloadType",
                            "source_payload_type",
                        ],
                    )
                })
            }),
        source_event_seq: metadata_u64(metadata, &["sourceEventSeq", "source_event_seq"]).or_else(
            || {
                raw_provenance
                    .and_then(|value| metadata_u64(value, &["sourceEventSeq", "source_event_seq"]))
            },
        ),
        source_call_id: metadata_string(metadata, &["sourceCallId", "source_call_id"]).or_else(
            || {
                raw_provenance
                    .and_then(|value| metadata_string(value, &["sourceCallId", "source_call_id"]))
            },
        ),
        source_provenance: provenance,
    };

    (!item_metadata_is_empty(&projected)).then_some(projected)
}

fn project_item_source_provenance(value: &Value) -> Option<v2::ThreadItemSourceProvenance> {
    let projected = v2::ThreadItemSourceProvenance {
        source_client: metadata_string(value, &["sourceClient", "source_client"]),
        source_thread_id: metadata_string(value, &["sourceThreadId", "source_thread_id"]),
        source_path: metadata_string(value, &["sourcePath", "source_path"]),
        source_event_type: metadata_string(value, &["sourceEventType", "source_event_type"]),
        source_event_seq: metadata_u64(value, &["sourceEventSeq", "source_event_seq"]),
        source_payload_type: metadata_string(value, &["sourcePayloadType", "source_payload_type"]),
        source_call_id: metadata_string(value, &["sourceCallId", "source_call_id"]),
        source_role: metadata_string(value, &["sourceRole", "source_role"]),
        source_channel: metadata_string(value, &["sourceChannel", "source_channel"]),
    };

    (!source_provenance_is_empty(&projected)).then_some(projected)
}

fn item_metadata_is_empty(metadata: &v2::ThreadItemMetadata) -> bool {
    metadata.imported.is_none()
        && metadata.imported_read_only.is_none()
        && metadata.imported_synthetic.is_none()
        && metadata.imported_incomplete.is_none()
        && metadata.imported_synthetic_id.is_none()
        && metadata.source_client.is_none()
        && metadata.source_thread_id.is_none()
        && metadata.source_event_type.is_none()
        && metadata.source_event_seq.is_none()
        && metadata.source_call_id.is_none()
        && metadata.source_provenance.is_none()
}

fn source_provenance_is_empty(provenance: &v2::ThreadItemSourceProvenance) -> bool {
    provenance.source_client.is_none()
        && provenance.source_thread_id.is_none()
        && provenance.source_path.is_none()
        && provenance.source_event_type.is_none()
        && provenance.source_event_seq.is_none()
        && provenance.source_payload_type.is_none()
        && provenance.source_call_id.is_none()
        && provenance.source_role.is_none()
        && provenance.source_channel.is_none()
}
