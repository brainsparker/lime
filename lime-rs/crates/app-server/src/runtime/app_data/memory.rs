use super::unavailable;
use super::NoopAppDataSource;
use super::RuntimeCoreError;
use crate::RolloutSummaryWriteParams;
use crate::{
    MemoryAgent, MemoryStageOneProvider, MemoryStageOneRoute, MemoryStageOneRunResult,
    MemoryStageOneVersion,
};
use app_server_protocol::*;
use async_trait::async_trait;

#[async_trait]
pub trait MemoryAppDataSource: Send + Sync {
    async fn record_memory_citation_usage(
        &self,
        _root: MemoryStoreRootParams,
        _citation: app_server_protocol::protocol::v2::MemoryCitation,
    ) -> Result<usize, RuntimeCoreError> {
        Ok(0)
    }

    async fn run_memory_stage1(
        &self,
        _root: MemoryStoreRootParams,
        _version: MemoryStageOneVersion,
        _route: MemoryStageOneRoute,
        _provider: &dyn MemoryStageOneProvider,
    ) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
        Err(unavailable("memory stage-1"))
    }

    async fn run_memory_stage2(
        &self,
        _root: MemoryStoreRootParams,
        _route: MemoryStageOneRoute,
        _provider: &dyn MemoryAgent,
    ) -> Result<MemoryStageOneRunResult, RuntimeCoreError> {
        Err(unavailable("memory stage-2"))
    }

    async fn memory_status(
        &self,
        _params: MemoryStatusParams,
    ) -> Result<MemoryStatusResponse, RuntimeCoreError> {
        Err(unavailable("memory/status"))
    }

    async fn read_project_memory(
        &self,
        _params: ProjectMemoryReadParams,
    ) -> Result<ProjectMemoryReadResponse, RuntimeCoreError> {
        Ok(ProjectMemoryReadResponse::default())
    }

    async fn list_memory_store(
        &self,
        _params: MemoryStoreListParams,
    ) -> Result<MemoryStoreListResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/list"))
    }

    async fn read_memory_store(
        &self,
        _params: MemoryStoreReadParams,
    ) -> Result<MemoryStoreReadResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/read"))
    }

    async fn search_memory_store(
        &self,
        _params: MemoryStoreSearchParams,
    ) -> Result<MemoryStoreSearchResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/search"))
    }

    async fn add_memory_store_note(
        &self,
        _params: MemoryStoreAddNoteParams,
    ) -> Result<MemoryStoreAddNoteResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/addNote"))
    }

    async fn write_memory_rollout_summary(
        &self,
        _params: RolloutSummaryWriteParams,
    ) -> Result<MemoryStoreAddNoteResponse, RuntimeCoreError> {
        Err(unavailable("memory rollout summary write"))
    }

    async fn consolidate_memory_store(
        &self,
        _params: MemoryStoreConsolidateParams,
        _route: MemoryStageOneRoute,
        _provider: &dyn MemoryAgent,
    ) -> Result<MemoryStoreConsolidateResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/consolidate"))
    }

    async fn list_memory_store_review_notes(
        &self,
        _params: MemoryStoreReviewListParams,
    ) -> Result<MemoryStoreReviewListResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/review/list"))
    }

    async fn resolve_memory_store_review_note(
        &self,
        _params: MemoryStoreReviewResolveParams,
    ) -> Result<MemoryStoreReviewResolveResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/review/resolve"))
    }

    async fn health_memory_store(
        &self,
        _params: MemoryStoreRootParams,
    ) -> Result<MemoryStoreHealthResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/health"))
    }

    async fn reset_memory(&self) -> Result<(), RuntimeCoreError> {
        Err(unavailable("memory/reset"))
    }

    async fn rebuild_memory_store_index(
        &self,
        _params: MemoryStoreRootParams,
    ) -> Result<MemoryStoreIndexRebuildResponse, RuntimeCoreError> {
        Err(unavailable("memoryStore/index/rebuild"))
    }
}

impl MemoryAppDataSource for NoopAppDataSource {}
