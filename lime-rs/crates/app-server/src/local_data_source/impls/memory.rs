use super::super::*;
use crate::MemoryAgent;
use app_server_protocol::{MemoryStatusParams, MemoryStatusResponse};
use async_trait::async_trait;

#[async_trait]
impl MemoryAppDataSource for LocalAppDataSource {
    async fn record_memory_citation_usage(
        &self,
        root: MemoryStoreRootParams,
        citation: app_server_protocol::protocol::v2::MemoryCitation,
    ) -> Result<usize, RuntimeCoreError> {
        self.memory_backend
            .record_citation_usage(root, citation)
            .await
    }

    async fn run_memory_stage1(
        &self,
        root: MemoryStoreRootParams,
        version: MemoryStageOneVersion,
        route: MemoryStageOneRoute,
        provider: &dyn MemoryStageOneProvider,
    ) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
        self.memory_backend
            .run_stage1(root, version, route, provider)
            .await
    }

    async fn run_memory_stage2(
        &self,
        root: MemoryStoreRootParams,
        route: MemoryStageOneRoute,
        provider: &dyn MemoryAgent,
    ) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
        self.memory_backend.run_stage2(root, route, provider).await
    }

    async fn memory_status(
        &self,
        params: MemoryStatusParams,
    ) -> Result<MemoryStatusResponse, RuntimeCoreError> {
        self.memory_backend.status(params).await
    }

    async fn read_project_memory(
        &self,
        params: ProjectMemoryReadParams,
    ) -> Result<ProjectMemoryReadResponse, RuntimeCoreError> {
        let memory = lime_core::memory::read_project_memory(self.db.clone(), &params.project_id)
            .map_err(data_error)?;
        Ok(ProjectMemoryReadResponse {
            memory: serde_json::to_value(memory).map_err(data_error)?,
        })
    }

    async fn list_memory_store(
        &self,
        params: MemoryStoreListParams,
    ) -> Result<MemoryStoreListResponse, RuntimeCoreError> {
        self.memory_backend.list(params).await
    }

    async fn read_memory_store(
        &self,
        params: MemoryStoreReadParams,
    ) -> Result<MemoryStoreReadResponse, RuntimeCoreError> {
        self.memory_backend.read(params).await
    }

    async fn search_memory_store(
        &self,
        params: MemoryStoreSearchParams,
    ) -> Result<MemoryStoreSearchResponse, RuntimeCoreError> {
        self.memory_backend.search(params).await
    }

    async fn add_memory_store_note(
        &self,
        params: MemoryStoreAddNoteParams,
    ) -> Result<MemoryStoreAddNoteResponse, RuntimeCoreError> {
        self.memory_backend.add_note(params).await
    }

    async fn write_memory_rollout_summary(
        &self,
        params: RolloutSummaryWriteParams,
    ) -> Result<MemoryStoreAddNoteResponse, RuntimeCoreError> {
        self.memory_backend.write_rollout_summary(params).await
    }

    async fn consolidate_memory_store(
        &self,
        params: MemoryStoreConsolidateParams,
        route: MemoryStageOneRoute,
        provider: &dyn MemoryAgent,
    ) -> Result<MemoryStoreConsolidateResponse, RuntimeCoreError> {
        self.memory_backend
            .consolidate(params, route, provider)
            .await
    }

    async fn list_memory_store_review_notes(
        &self,
        params: MemoryStoreReviewListParams,
    ) -> Result<MemoryStoreReviewListResponse, RuntimeCoreError> {
        self.memory_backend.list_review(params).await
    }

    async fn resolve_memory_store_review_note(
        &self,
        params: MemoryStoreReviewResolveParams,
    ) -> Result<MemoryStoreReviewResolveResponse, RuntimeCoreError> {
        self.memory_backend.resolve_review(params).await
    }

    async fn health_memory_store(
        &self,
        params: MemoryStoreRootParams,
    ) -> Result<MemoryStoreHealthResponse, RuntimeCoreError> {
        self.memory_backend.health(params).await
    }

    async fn reset_memory(&self) -> Result<(), RuntimeCoreError> {
        self.memory_backend.reset().await
    }

    async fn rebuild_memory_store_index(
        &self,
        params: MemoryStoreRootParams,
    ) -> Result<MemoryStoreIndexRebuildResponse, RuntimeCoreError> {
        self.memory_backend.rebuild_index(params).await
    }
}
