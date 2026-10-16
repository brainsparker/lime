//! Order transport response settlement with the Thread listener before waking consumers.

use super::*;
use crate::thread_state::ThreadListenerCommand;
use agent_protocol::ThreadId;
use app_server_protocol::JsonRpcNotification;

pub(crate) struct ResolvedServerRequest {
    id: RequestId,
    resolution: ServerRequestResolution,
    sender: oneshot::Sender<ServerRequestResolution>,
}

impl ResolvedServerRequest {
    pub(crate) fn notification(&self, thread_id: &str) -> JsonRpcNotification {
        ServerNotification::ServerRequestResolved(ServerRequestResolvedNotification {
            thread_id: thread_id.to_string(),
            request_id: self.id.clone(),
        })
        .into()
    }

    pub(crate) fn origin_connection_id(&self) -> Option<ConnectionId> {
        match self.resolution.owner {
            Some(ServerRequestOwner::Transport(connection_id)) => Some(connection_id),
            #[cfg(test)]
            Some(ServerRequestOwner::Subscriber) => None,
            None => None,
        }
    }

    pub(crate) fn complete(mut self, resolved_in_listener: bool) -> Result<(), ServerRequestError> {
        self.resolution.resolved_in_listener = resolved_in_listener;
        self.sender
            .send(self.resolution)
            .map_err(|_| ServerRequestError::ResponseChannelClosed { id: self.id })
    }
}

impl ServerRequestRouter {
    fn response_thread(
        &self,
        owner: ServerRequestOwner,
        id: &RequestId,
    ) -> Result<Option<String>, ServerRequestError> {
        let pending = self
            .inner
            .pending
            .lock()
            .expect("server request router mutex poisoned");
        let route = pending
            .get(id)
            .ok_or_else(|| ServerRequestError::RequestNotFound { id: id.clone() })?;
        if !route.has_owner(owner) {
            return Err(ServerRequestError::ClientMismatch { id: id.clone() });
        }
        // Host clock reads have no interactive resolved notification contract.
        Ok(
            (route.request.method != app_server_protocol::protocol::v2::METHOD_CURRENT_TIME_READ)
                .then(|| route.thread_id.clone())
                .flatten(),
        )
    }

    pub(crate) fn take_response(
        &self,
        owner: ServerRequestOwner,
        id: RequestId,
        result: ServerRequestResult,
    ) -> Result<ResolvedServerRequest, ServerRequestError> {
        let mut pending = self
            .inner
            .pending
            .lock()
            .expect("server request router mutex poisoned");
        let route = pending
            .get(&id)
            .ok_or_else(|| ServerRequestError::RequestNotFound { id: id.clone() })?;
        if !route.has_owner(owner) {
            return Err(ServerRequestError::ClientMismatch { id });
        }
        let route = pending
            .remove(&id)
            .expect("pending server request disappeared while locked");
        Ok(ResolvedServerRequest {
            id,
            resolution: ServerRequestResolution {
                owner: Some(owner),
                result,
                resolved_in_listener: false,
            },
            sender: route.sender,
        })
    }
}

impl AppServer {
    pub(crate) async fn resolve_transport_server_request_response(
        &self,
        connection_id: ConnectionId,
        id: RequestId,
        result: Value,
    ) {
        self.resolve_transport_server_request(connection_id, id, Ok(result))
            .await;
    }

    pub(crate) async fn resolve_transport_server_request_error(
        &self,
        connection_id: ConnectionId,
        id: RequestId,
        error: JsonRpcError,
    ) {
        self.resolve_transport_server_request(connection_id, id, Err(error))
            .await;
    }

    async fn resolve_transport_server_request(
        &self,
        connection_id: ConnectionId,
        id: RequestId,
        result: ServerRequestResult,
    ) {
        let request_id = id.clone();
        if let Err(error) = self
            .settle_transport_response(connection_id, id, result)
            .await
        {
            tracing::warn!(%request_id, %connection_id, %error, "dropping unmatched App Server transport response");
        }
    }

    async fn settle_transport_response(
        &self,
        connection_id: ConnectionId,
        id: RequestId,
        result: ServerRequestResult,
    ) -> Result<(), AppServerError> {
        let owner = ServerRequestOwner::Transport(connection_id);
        let Some(thread_id) = self.server_requests.response_thread(owner, &id)? else {
            return self
                .server_requests
                .resolve(owner, id, result)
                .map_err(AppServerError::from);
        };
        let (completion_tx, completion_rx) = oneshot::channel();
        self.event_bridge()
            .send_thread_command(
                ThreadId::new(thread_id),
                ThreadListenerCommand::ResolveServerRequest {
                    owner,
                    id,
                    result,
                    completion_tx,
                },
            )
            .await
            .map_err(AppServerError::ThreadListener)?;
        completion_rx
            .await
            .map_err(|error| AppServerError::ThreadListener(error.to_string()))??;
        Ok(())
    }
}
