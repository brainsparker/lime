use super::*;

pub(crate) fn model_catalog(
    db: &DbConnection,
    api_key_provider_service: &ApiKeyProviderService,
    model_registry_service: &ModelRegistryService,
    query: crate::ModelCatalogQuery,
) -> Result<Vec<crate::ProviderModelCatalog>, RuntimeCoreError> {
    let provider_filter = query
        .provider_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let providers = api_key_provider_service
        .get_all_providers(db)
        .map_err(data_error)?;
    let mut catalogs = Vec::new();

    for provider in providers {
        if !configured_provider_readiness(&provider).ready {
            continue;
        }
        let provider_id = provider.provider.id.as_str();
        if provider_filter.is_some_and(|filter| filter != provider_id) {
            continue;
        }
        let mut models = Vec::new();
        let mut seen = HashSet::new();
        let mut cached_models = Vec::new();
        append_cached_provider_models(
            db,
            api_key_provider_service,
            model_registry_service,
            &provider,
            &mut cached_models,
            &mut HashSet::new(),
        );

        for model_id in &provider.provider.models {
            // Match runtime route metadata: discovered scoped catalog data
            // takes precedence over declarations without losing configured order.
            let model = cached_models
                .iter()
                .find(|model| model.id.trim().eq_ignore_ascii_case(model_id.id.trim()))
                .cloned()
                .map(|model| ModelRegistryService::merge_declared_capabilities(model, model_id))
                .unwrap_or_else(|| {
                    model_registry_service.build_declared_model_metadata_for_endpoint(
                        provider_id,
                        &provider.provider.api_host,
                        model_id,
                    )
                });
            append_model(&mut models, &mut seen, model);
        }

        for model in cached_models {
            append_model(&mut models, &mut seen, model);
        }
        catalogs.push(crate::ProviderModelCatalog {
            provider_id: provider_id.to_string(),
            sort_order: provider.provider.sort_order,
            models,
        });
    }

    catalogs.sort_by(|left, right| {
        left.sort_order
            .cmp(&right.sort_order)
            .then_with(|| left.provider_id.cmp(&right.provider_id))
    });
    Ok(catalogs)
}

pub(crate) fn has_model_provider_last_success(
    db: &DbConnection,
    api_key_provider_service: &ApiKeyProviderService,
    model_registry_service: &ModelRegistryService,
    provider_id: &str,
) -> Result<bool, RuntimeCoreError> {
    let Some(provider) = api_key_provider_service
        .get_provider(db, provider_id)
        .map_err(data_error)?
    else {
        return Ok(false);
    };
    let provider_id = provider.provider.id.as_str();
    let api_host = provider.provider.api_host.as_str();
    if api_host.trim().is_empty() {
        return Ok(false);
    }
    model_registry_service
        .get_cached_provider_models(
            provider_id,
            api_host,
            Some(provider.provider.effective_provider_type()),
        )
        .map(|cached| cached.is_some())
        .map_err(data_error)
}

fn append_model(
    models: &mut Vec<EnhancedModelMetadata>,
    seen: &mut HashSet<String>,
    model: EnhancedModelMetadata,
) {
    let key = model_dedupe_key(&model);
    if seen.insert(key) {
        models.push(model);
    }
}

fn append_cached_provider_models(
    db: &DbConnection,
    api_key_provider_service: &ApiKeyProviderService,
    model_registry_service: &ModelRegistryService,
    provider: &ProviderWithKeys,
    models: &mut Vec<EnhancedModelMetadata>,
    seen: &mut HashSet<String>,
) {
    let provider_id = provider.provider.id.as_str();
    let api_host = provider.provider.api_host.as_str();
    let provider_type = provider.provider.effective_provider_type();
    let enabled_keys = provider.api_keys.iter().filter(|key| key.enabled);
    let mut has_enabled_key = false;

    for key in enabled_keys {
        has_enabled_key = true;
        let credential_ref = runtime_api_key_credential_uuid(&key.id);
        let credential = match api_key_provider_service.select_runtime_credential_by_ref(
            db,
            provider_id,
            &credential_ref,
        ) {
            Ok(Some(credential)) => credential,
            Ok(None) => continue,
            Err(error) => {
                tracing::warn!(
                    "[ModelProvider] 读取 Provider scoped 模型缓存凭证失败: provider={}, key_id={}, error={}",
                    provider_id,
                    key.id,
                    error
                );
                continue;
            }
        };
        append_cached_models_for_access(
            model_registry_service,
            provider_id,
            api_host,
            provider_type,
            ProviderModelCacheAccess::Credential(&credential),
            models,
            seen,
        );
    }

    if has_enabled_key {
        append_cached_models_for_access(
            model_registry_service,
            provider_id,
            api_host,
            provider_type,
            ProviderModelCacheAccess::Keyless,
            models,
            seen,
        );
    } else if !ModelRegistryService::requires_api_key_for_runtime(
        provider_id,
        api_host,
        provider_type,
    ) {
        append_cached_models_for_access(
            model_registry_service,
            provider_id,
            api_host,
            provider_type,
            ProviderModelCacheAccess::Keyless,
            models,
            seen,
        );
    }
}

fn append_cached_models_for_access(
    model_registry_service: &ModelRegistryService,
    provider_id: &str,
    api_host: &str,
    provider_type: ApiProviderType,
    cache_access: ProviderModelCacheAccess<'_>,
    models: &mut Vec<EnhancedModelMetadata>,
    seen: &mut HashSet<String>,
) {
    match model_registry_service.get_cached_provider_models_for_access(
        provider_id,
        api_host,
        Some(provider_type),
        cache_access,
    ) {
        Ok(Some(result)) => {
            for model in result.models {
                append_model(models, seen, model);
            }
        }
        Ok(None) => {}
        Err(error) => {
            tracing::warn!(
                "[ModelProvider] 读取 Provider 模型缓存失败，跳过缓存模型: provider={}, error={}",
                provider_id,
                error
            );
        }
    }
}

fn model_dedupe_key(model: &EnhancedModelMetadata) -> String {
    model.id.trim().to_ascii_lowercase()
}
