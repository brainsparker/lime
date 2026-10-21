use super::{dispatch_result, to_jsonrpc_error, RequestProcessor, RpcDispatch};
use app_server_protocol::protocol::v2::RolloutCompressResponse;
use app_server_protocol::JsonRpcError;

impl RequestProcessor {
    pub(super) async fn handle_rollout_compress(&self) -> Result<RpcDispatch, JsonRpcError> {
        self.ensure_initialized()?;
        self.ensure_experimental_api("rollout/compress")?;
        self.runtime.compress_rollouts().map_err(to_jsonrpc_error)?;
        // ACK only: the pass runs independently of this connection/request.
        dispatch_result(RolloutCompressResponse {})
    }
}
