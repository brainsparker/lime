//! MCP elicitation adapter for the App Server reverse-request transport.

use crate::{AppServer, AppServerError, ServerRequestError};
use app_server_protocol::error_codes;
use app_server_protocol::protocol::v2::{
    McpServerElicitationAction, McpServerElicitationRequest, McpServerElicitationRequestParams,
    McpServerElicitationRequestResponse, METHOD_MCP_SERVER_ELICITATION_REQUEST,
};
use lime_mcp::{
    ElicitationAction, ElicitationRequest, ElicitationRequestRouter, ElicitationResponse,
    ElicitationRouterError,
};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;

struct ElicitationRequestSubscription {
    router: ElicitationRequestRouter,
    receiver: mpsc::Receiver<ElicitationRequest>,
}

#[derive(Clone, Default)]
pub(crate) struct ElicitationRequestSource {
    subscription: Arc<Mutex<Option<ElicitationRequestSubscription>>>,
}

impl ElicitationRequestSource {
    pub(crate) fn subscribe(
        router: ElicitationRequestRouter,
    ) -> Result<Self, ElicitationRouterError> {
        let receiver = router.subscribe()?;
        router.defer_cancellation_to_consumer();
        Ok(Self {
            subscription: Arc::new(Mutex::new(Some(ElicitationRequestSubscription {
                router,
                receiver,
            }))),
        })
    }

    fn take(&self) -> Option<ElicitationRequestSubscription> {
        self.subscription
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
    }
}

pub(crate) async fn run_request_pump(
    server: AppServer,
    source: ElicitationRequestSource,
    shutdown: CancellationToken,
) {
    let Some(ElicitationRequestSubscription {
        router,
        mut receiver,
    }) = source.take()
    else {
        return;
    };
    let mut pending = JoinSet::new();
    loop {
        tokio::select! {
            _ = shutdown.cancelled() => {
                router.cancel_all();
                break;
            }
            request = receiver.recv() => {
                let Some(request) = request else {
                    break;
                };
                if !router.mark_forwarded(&request.id) {
                    continue;
                }
                let server = server.clone();
                let router = router.clone();
                pending.spawn(async move {
                    forward_request(server, router, request).await;
                });
            }
            Some(result) = pending.join_next(), if !pending.is_empty() => {
                if let Err(error) = result {
                    tracing::warn!(%error, "MCP elicitation adapter task failed");
                }
            }
        }
    }

    while let Some(result) = pending.join_next().await {
        if let Err(error) = result {
            tracing::warn!(%error, "MCP elicitation adapter task failed during shutdown");
        }
    }
}

async fn forward_request(
    server: AppServer,
    router: ElicitationRequestRouter,
    request: ElicitationRequest,
) {
    let request_id = request.id.clone();
    let params = match request_params(&request) {
        Ok(params) => params,
        Err(error) => {
            tracing::warn!(%request_id, %error, "declining invalid MCP elicitation request");
            resolve_router_response(&router, &request_id, ElicitationResponse::Decline).await;
            return;
        }
    };

    let pending = match server
        .begin_thread_server_request(
            &request.thread_id,
            METHOD_MCP_SERVER_ELICITATION_REQUEST,
            params,
        )
        .await
    {
        Ok(pending) => pending,
        Err(error) => {
            let response = response_for_server_error(&error);
            tracing::warn!(%request_id, %error, action = ?response, "settling MCP elicitation after client delivery failure");
            resolve_router_response(&router, &request_id, response).await;
            return;
        }
    };
    let terminal = wait_for_outer_terminal(pending, request.closed(), request_id.to_string()).await;
    settle_outer_terminal(&server, &router, &request_id, &request.thread_id, terminal).await;
}

struct OuterTerminal {
    response: Option<ElicitationResponse>,
    owner: Option<crate::server_request::ServerRequestOwner>,
    outer_request_id: app_server_protocol::RequestId,
    resolved_in_listener: bool,
}

async fn wait_for_outer_terminal(
    mut pending: crate::server_request::PendingServerRequest,
    closed: CancellationToken,
    domain_request_id: String,
) -> OuterTerminal {
    let outer_request_id = pending.id().clone();
    let terminal = tokio::select! {
        biased;
        _ = closed.cancelled() => None,
        terminal = pending.wait_terminal() => Some(terminal),
    };
    let (owner, outer_response, resolved_in_listener) = match terminal {
        None => match pending.cancel_with_owner() {
            Some(owner) => (Some(owner), None, false),
            None => {
                let terminal = pending.wait_terminal().await;
                (terminal.owner, None, terminal.resolved_in_listener)
            }
        },
        Some(terminal) => (
            terminal.owner,
            Some(terminal.result.map_err(AppServerError::from)),
            terminal.resolved_in_listener,
        ),
    };

    let response = match outer_response {
        Some(Ok(value)) => match parse_response(value) {
            Ok(response) => Some(response),
            Err(error) => {
                tracing::warn!(request_id = %domain_request_id, %error, "canceling invalid App Server MCP elicitation response");
                Some(ElicitationResponse::Cancel)
            }
        },
        Some(Err(error)) => {
            let response = response_for_server_error(&error);
            tracing::warn!(request_id = %domain_request_id, %error, action = ?response, "settling MCP elicitation after client response failure");
            Some(response)
        }
        None => None,
    };

    OuterTerminal {
        response,
        owner,
        outer_request_id,
        resolved_in_listener,
    }
}

async fn notify_resolved(
    server: &AppServer,
    owner: Option<crate::server_request::ServerRequestOwner>,
    thread_id: &str,
    request_id: app_server_protocol::RequestId,
) {
    if let Err(error) = server
        .publish_server_request_resolved(thread_id, request_id.clone(), owner)
        .await
    {
        tracing::warn!(%request_id, %error, "failed to publish App Server server-request terminal notification");
    }
}

fn request_params(
    request: &ElicitationRequest,
) -> Result<McpServerElicitationRequestParams, serde_json::Error> {
    let requested_schema = serde_json::to_value(&request.requested_schema)?;
    let requested_schema = serde_json::from_value(requested_schema)?;
    Ok(McpServerElicitationRequestParams {
        thread_id: request.thread_id.clone(),
        turn_id: request.turn_id.clone(),
        server_name: request.server_name.clone(),
        request: McpServerElicitationRequest::Form {
            meta: request.meta.clone(),
            message: request.message.clone(),
            requested_schema,
        },
    })
}

fn parse_response(value: serde_json::Value) -> Result<ElicitationResponse, String> {
    let response: McpServerElicitationRequestResponse =
        serde_json::from_value(value).map_err(|error| error.to_string())?;
    response.validate().map_err(str::to_string)?;
    let action = match response.action {
        McpServerElicitationAction::Accept => ElicitationAction::Accept,
        McpServerElicitationAction::Decline => ElicitationAction::Decline,
        McpServerElicitationAction::Cancel => ElicitationAction::Cancel,
    };
    ElicitationResponse::try_from_parts_with_meta(
        action,
        response.content,
        response.meta.map(serde_json::Value::Object),
    )
    .map_err(|error| error.to_string())
}

fn response_for_server_error(error: &AppServerError) -> ElicitationResponse {
    match error {
        AppServerError::ServerRequest(ServerRequestError::ClientRejected { error, .. })
            if error.code != error_codes::REQUEST_CANCELLED =>
        {
            ElicitationResponse::Decline
        }
        AppServerError::Json(_) => ElicitationResponse::Decline,
        _ => ElicitationResponse::Cancel,
    }
}

async fn resolve_router_response(
    router: &ElicitationRequestRouter,
    request_id: &lime_mcp::ElicitationRequestId,
    response: ElicitationResponse,
) {
    match router.resolve(request_id, response).await {
        Ok(()) | Err(ElicitationRouterError::UnknownRequest(_)) => {}
        Err(ElicitationRouterError::InvalidContent(error)) => {
            tracing::warn!(%request_id, %error, "declining MCP elicitation response rejected by its original schema");
            if let Err(error) = router
                .resolve(request_id, ElicitationResponse::Decline)
                .await
            {
                if !matches!(error, ElicitationRouterError::UnknownRequest(_)) {
                    tracing::warn!(%request_id, %error, "failed to decline MCP elicitation request");
                }
            }
        }
        Err(error) => {
            tracing::warn!(%request_id, %error, "failed to resolve MCP elicitation response");
        }
    }
}

async fn settle_outer_terminal(
    server: &AppServer,
    router: &ElicitationRequestRouter,
    request_id: &lime_mcp::ElicitationRequestId,
    thread_id: &str,
    terminal: OuterTerminal,
) {
    let response = terminal.response.unwrap_or(ElicitationResponse::Cancel);
    let claim = match router.claim(request_id, response) {
        Ok(claim) => claim,
        Err(ElicitationRouterError::InvalidContent(error)) => {
            tracing::warn!(%request_id, %error, "declining MCP elicitation response rejected by its original schema");
            match router.claim(request_id, ElicitationResponse::Decline) {
                Ok(claim) => claim,
                Err(error) => {
                    tracing::warn!(%request_id, %error, "failed to claim declined MCP elicitation response");
                    return;
                }
            }
        }
        // The RMCP call may have canceled first, or App Server shutdown may
        // have already released the waiter. Every subscribed form must receive
        // its terminal notification exactly once.
        Err(ElicitationRouterError::UnknownRequest(_)) => {
            if !terminal.resolved_in_listener {
                notify_resolved(server, terminal.owner, thread_id, terminal.outer_request_id).await;
            }
            return;
        }
        Err(error) => {
            tracing::warn!(%request_id, %error, "failed to claim MCP elicitation terminal");
            return;
        }
    };
    if !terminal.resolved_in_listener {
        notify_resolved(server, terminal.owner, thread_id, terminal.outer_request_id).await;
    }
    if let Err(error) = claim.consume() {
        tracing::warn!(%request_id, %error, "failed to consume claimed MCP elicitation terminal");
    }
}

#[cfg(test)]
mod tests;
