//! App Server message entry points for direct and transport clients.

use super::{
    experimental_api_field_reason, experimental_api_required_message, initialize_experimental_api,
    is_experimental_api_method, transport_experimental_api_enabled, AppServer, AppServerError,
};
use app_server_protocol::{error_codes, JsonRpcError, JsonRpcMessage, METHOD_INITIALIZE};
use app_server_transport::{decode_message, encode_message, ConnectionId};

impl AppServer {
    pub async fn handle_json_line(&self, line: &str) -> Result<Vec<String>, AppServerError> {
        let message = decode_message(line)?;
        self.handle_message(message)
            .await?
            .iter()
            .map(|message| encode_message(message).map_err(AppServerError::from))
            .collect()
    }

    pub async fn handle_message(
        &self,
        message: JsonRpcMessage,
    ) -> Result<Vec<JsonRpcMessage>, AppServerError> {
        self.ensure_runtime_event_pump();
        match message {
            JsonRpcMessage::Request(request) => self.processor.handle_request(request).await,
            JsonRpcMessage::Notification(notification) => {
                self.processor.handle_notification(notification);
                Ok(Vec::new())
            }
            JsonRpcMessage::Response(_response) => {
                #[cfg(test)]
                self.resolve_test_server_request_response(_response.id, _response.result);
                Ok(Vec::new())
            }
            JsonRpcMessage::Error(_response) => {
                #[cfg(test)]
                self.resolve_test_server_request_error(_response.id, _response.error);
                Ok(Vec::new())
            }
        }
    }

    pub(super) async fn handle_transport_message(
        &self,
        connection_id: ConnectionId,
        message: JsonRpcMessage,
    ) -> Result<Vec<JsonRpcMessage>, AppServerError> {
        self.ensure_runtime_event_pump();
        match message {
            JsonRpcMessage::Request(request) => {
                if !transport_experimental_api_enabled(
                    &self.transport_experimental_api,
                    connection_id,
                ) {
                    if let Some(reason) = experimental_api_field_reason(&request) {
                        return Ok(vec![JsonRpcMessage::Error(
                            app_server_protocol::JsonRpcErrorResponse {
                                id: request.id.clone(),
                                error: JsonRpcError::new(
                                    error_codes::INVALID_REQUEST,
                                    format!("{reason} requires experimentalApi capability"),
                                ),
                            },
                        )]);
                    }
                    if is_experimental_api_method(&request.method) {
                        return Ok(vec![JsonRpcMessage::Error(
                            app_server_protocol::JsonRpcErrorResponse {
                                id: request.id.clone(),
                                error: JsonRpcError::new(
                                    error_codes::INVALID_REQUEST,
                                    experimental_api_required_message(&request.method),
                                ),
                            },
                        )]);
                    }
                }
                let initialize_capability =
                    initialize_experimental_api(&JsonRpcMessage::Request(request.clone()));
                let initialize_request = request.method == METHOD_INITIALIZE;
                let responses = self
                    .processor
                    .handle_transport_request(connection_id, request)
                    .await?;
                if initialize_request
                    && initialize_capability
                    && responses
                        .iter()
                        .any(|response| matches!(response, JsonRpcMessage::Response(_)))
                {
                    self.transport_experimental_api
                        .lock()
                        .expect("app-server transport experimental capability mutex poisoned")
                        .insert(connection_id);
                }
                Ok(responses)
            }
            JsonRpcMessage::Notification(notification) => {
                self.processor
                    .handle_transport_notification(connection_id, notification);
                Ok(Vec::new())
            }
            JsonRpcMessage::Response(response) => {
                self.resolve_transport_server_request_response(
                    connection_id,
                    response.id,
                    response.result,
                )
                .await;
                Ok(Vec::new())
            }
            JsonRpcMessage::Error(response) => {
                self.resolve_transport_server_request_error(
                    connection_id,
                    response.id,
                    response.error,
                )
                .await;
                Ok(Vec::new())
            }
        }
    }

    pub async fn handle_message_streaming(
        &self,
        message: JsonRpcMessage,
        event_callback: &mut (dyn FnMut(JsonRpcMessage) + Send),
    ) -> Result<Vec<JsonRpcMessage>, AppServerError> {
        self.ensure_runtime_event_pump();
        match message {
            JsonRpcMessage::Request(request) => {
                self.processor
                    .handle_request_streaming(request, event_callback)
                    .await
            }
            JsonRpcMessage::Notification(notification) => {
                self.processor.handle_notification(notification);
                Ok(Vec::new())
            }
            JsonRpcMessage::Response(_response) => {
                #[cfg(test)]
                self.resolve_test_server_request_response(_response.id, _response.result);
                Ok(Vec::new())
            }
            JsonRpcMessage::Error(_response) => {
                #[cfg(test)]
                self.resolve_test_server_request_error(_response.id, _response.error);
                Ok(Vec::new())
            }
        }
    }
}
