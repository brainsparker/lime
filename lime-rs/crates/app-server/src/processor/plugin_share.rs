//! Workspace plugin shares use the same account queue and runtime as other surfaces.
use super::{dispatch_result, parse_params, to_jsonrpc_error, RequestProcessor, RpcDispatch};
use app_server_protocol::JsonRpcError;

impl RequestProcessor {
    pub(super) async fn handle_plugin_share_checkout_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        dispatch_result(
            self.runtime
                .checkout_plugin_share(parse_params(params)?)
                .await
                .map_err(to_jsonrpc_error)?,
        )
    }
    pub(super) async fn handle_plugin_share_save_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        dispatch_result(
            self.runtime
                .save_plugin_share(parse_params(params)?)
                .await
                .map_err(to_jsonrpc_error)?,
        )
    }
    pub(super) async fn handle_plugin_share_list_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        dispatch_result(
            self.runtime
                .list_plugin_shares(parse_params(params)?)
                .await
                .map_err(to_jsonrpc_error)?,
        )
    }
    pub(super) async fn handle_plugin_share_update_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        dispatch_result(
            self.runtime
                .update_plugin_share_targets(parse_params(params)?)
                .await
                .map_err(to_jsonrpc_error)?,
        )
    }
    pub(super) async fn handle_plugin_share_delete_v2_impl(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        dispatch_result(
            self.runtime
                .delete_plugin_share(parse_params(params)?)
                .await
                .map_err(to_jsonrpc_error)?,
        )
    }
}
