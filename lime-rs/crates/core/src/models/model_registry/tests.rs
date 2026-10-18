use super::*;

#[test]
fn test_model_tier_inference() {
    assert_eq!(
        infer_model_tier("claude-opus-4-5-20250514", "Claude Opus 4.5"),
        ModelTier::Max
    );
    assert_eq!(
        infer_model_tier("gpt-4o-mini", "GPT-4o Mini"),
        ModelTier::Mini
    );
    assert_eq!(
        infer_model_tier("claude-sonnet-4-5", "Claude Sonnet 4.5"),
        ModelTier::Pro
    );
    assert_eq!(
        infer_model_tier("gemini-2.5-flash", "Gemini 2.5 Flash"),
        ModelTier::Mini
    );
}

#[test]
fn test_model_status_parsing() {
    assert_eq!(
        "active".parse::<ModelStatus>().unwrap(),
        ModelStatus::Active
    );
    assert_eq!(
        "deprecated".parse::<ModelStatus>().unwrap(),
        ModelStatus::Deprecated
    );
    assert_eq!("beta".parse::<ModelStatus>().unwrap(), ModelStatus::Beta);
}
