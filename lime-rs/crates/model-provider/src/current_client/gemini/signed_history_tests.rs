use super::*;

#[test]
fn signed_reasoning_and_text_finish_as_distinct_ordered_envelopes() {
    let mut state = GeminiStreamState::default();
    let mut events = Vec::new();
    for part in [
        json!({"text":"first ","thought":true}),
        json!({"text":"thought","thought":true}),
        json!({"thoughtSignature":"reasoning-signature"}),
        json!({"text":"answer","thoughtSignature":"text-signature"}),
        json!({"text":"second thought","thought":true,"thoughtSignature":"second-signature"}),
    ] {
        events.extend(
            reduce_event(
                &mut state,
                &json!({"candidates":[{"content":{"parts":[part]}}]}),
            )
            .unwrap(),
        );
    }
    events.extend(finish_stream(&mut state));
    let completed = events
        .iter()
        .filter_map(|event| match event {
            LlmEvent::ResponseItemDone {
                source_id, item, ..
            } => Some((source_id.as_str(), item)),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(
        completed.iter().map(|(id, _)| *id).collect::<Vec<_>>(),
        vec!["reasoning-0", "text-0", "reasoning-1"]
    );
    assert_eq!(completed[0].1["content"][0]["text"], "first thought");
    assert_eq!(
        completed[0].1["native"]["parts"],
        json!([
            {"text":"first ","thought":true},
            {"text":"thought","thought":true,"thoughtSignature":"reasoning-signature"}
        ])
    );
    assert_eq!(
        completed[1].1["native"]["parts"][0]["thoughtSignature"],
        "text-signature"
    );
    assert!(
        close_content(&mut state).is_empty(),
        "completion must not be duplicated"
    );
}

#[test]
fn unsigned_content_keeps_portable_projection_without_native_receipt() {
    let mut state = GeminiStreamState::default();
    reduce_event(
        &mut state,
        &json!({"candidates":[{"content":{"parts":[{"text":"thought","thought":true}]}}]}),
    )
    .unwrap();
    assert!(matches!(
        close_content(&mut state).as_slice(),
        [LlmEvent::ReasoningEnd { .. }]
    ));
}
