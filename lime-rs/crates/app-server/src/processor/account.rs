use super::{dispatch_result, parse_params, to_jsonrpc_error, RequestProcessor, RpcDispatch};
use app_server_protocol::protocol::v2::{
    AccountUpdatedNotification, CloudRequestParams, GetAccountParams, LoginAccountParams,
    ServerNotification,
};
use app_server_protocol::JsonRpcError;

impl RequestProcessor {
    pub(super) async fn handle_cloud_request(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: CloudRequestParams = parse_params(params)?;
        dispatch_result(
            self.runtime
                .request_cloud(params)
                .await
                .map_err(to_jsonrpc_error)?,
        )
    }

    pub(super) async fn handle_account_login_start(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: LoginAccountParams = parse_params(params)?;
        let response = self
            .runtime
            .login_account(params)
            .await
            .map_err(to_jsonrpc_error)?;
        self.publish_server_notification(ServerNotification::AccountUpdated(
            AccountUpdatedNotification {
                auth_mode: Some("cloudAuthTokens".to_string()),
                plan_type: None,
            },
        ))
        .await;
        dispatch_result(response)
    }

    pub(super) async fn handle_account_read(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let params: GetAccountParams = parse_params(params)?;
        dispatch_result(
            self.runtime
                .read_account(params)
                .map_err(to_jsonrpc_error)?,
        )
    }

    pub(super) async fn handle_account_logout(
        &self,
        params: Option<serde_json::Value>,
    ) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        let _: Option<()> = parse_params(params.or(Some(serde_json::Value::Null)))?;
        let response = self.runtime.logout_account().map_err(to_jsonrpc_error)?;
        self.publish_server_notification(ServerNotification::AccountUpdated(
            AccountUpdatedNotification {
                auth_mode: None,
                plan_type: None,
            },
        ))
        .await;
        dispatch_result(response)
    }
}
