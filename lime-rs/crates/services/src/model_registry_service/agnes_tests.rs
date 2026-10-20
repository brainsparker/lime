use super::*;

fn service() -> ModelRegistryService {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )
    .unwrap();
    ModelRegistryService::new(Arc::new(std::sync::Mutex::new(conn)))
}

#[test]
fn official_agnes_media_capabilities_authorize_only_the_matching_task() {
    let service = service();
    for model_id in [
        "agnes-image-2.0-flash",
        "agnes-image-2.1-flash",
        "agnes-image-2.5-flash",
    ] {
        let model = service.build_declared_model_metadata_for_endpoint(
            "custom-provider",
            "https://apihub.agnes-ai.com/v1",
            &ProviderModelConfig::hint(model_id),
        );
        assert_eq!(
            model.capability_provenance,
            ModelCapabilityProvenance::Canonical
        );
        assert!(model
            .task_families
            .contains(&ModelTaskFamily::ImageGeneration));
        assert!(model.task_families.contains(&ModelTaskFamily::ImageEdit));
        assert_eq!(model.output_modalities, [ModelModality::Image]);
        assert!(!model.task_families.contains(&ModelTaskFamily::Chat));
        assert!(!model.capabilities.tools);
    }
    for model_id in ["agnes-video-2.5", "agnes-video-2.5-flash"] {
        let model = service.build_declared_model_metadata_for_endpoint(
            "custom-provider",
            "https://apihub.agnes-ai.com/v1",
            &ProviderModelConfig::hint(model_id),
        );
        assert_eq!(model.task_families, [ModelTaskFamily::VideoGeneration]);
        assert_eq!(model.output_modalities, [ModelModality::Video]);
        assert!(!model.capabilities.tools);
    }
}

#[test]
fn agnes_capabilities_are_not_authorized_on_untrusted_endpoints() {
    let service = service();
    for model_id in ["agnes-3.0-flash", "agnes-3.0-pro", "agnes-image-2.5-flash"] {
        for host in [
            "https://relay.example.com/v1",
            "https://apihub.agnes-ai.com.example.com/v1",
        ] {
            let model = service.build_declared_model_metadata_for_endpoint(
                "custom-provider",
                host,
                &ProviderModelConfig::hint(model_id),
            );
            assert_eq!(
                model.capability_provenance,
                ModelCapabilityProvenance::InferredHint
            );
            assert!(model.canonical_model_id.is_none());
        }
    }
}
