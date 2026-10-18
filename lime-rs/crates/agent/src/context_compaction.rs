use crate::provider_configuration::{
    configure_model_route_provider_for_session_with_provider_and_credential_ref,
    ModelRouteProviderConfiguration,
};
use crate::AgentRuntimeState;
use lime_core::database::DbConnection;
use model_provider::current_client::CurrentProviderRequest;
use tokio_util::sync::CancellationToken;

pub async fn run_context_compaction_with_db(
    state: &AgentRuntimeState,
    db: &DbConnection,
    configuration: ModelRouteProviderConfiguration,
    request: CurrentProviderRequest,
    cancellation: CancellationToken,
) -> Result<String, String> {
    let session_id = request
        .metadata
        .as_ref()
        .map(|metadata| metadata.session_id.clone())
        .ok_or_else(|| "Context compaction requires canonical request metadata".to_string())?;
    let credential_ref = configuration.credential_ref.clone();
    let provider = configure_model_route_provider_for_session_with_provider_and_credential_ref(
        state,
        db,
        &session_id,
        configuration,
        credential_ref.as_deref(),
    )
    .await?;
    let session = provider.provider().session();
    agent_runtime::context_compaction::summarize_context(&session, request, cancellation)
        .await
        .map(|summary| format!("{}\n{summary}", crate::SUMMARY_PREFIX))
        .map_err(|error| error.to_string())
}
