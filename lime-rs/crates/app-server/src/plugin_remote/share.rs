use super::{upload, wire, Context};
use crate::runtime::RuntimeCoreError;
use app_server_protocol::protocol::v2::{
    Account, CloudRequestMethod, PluginShareDiscoverability, PluginSharePrincipal,
    PluginSharePrincipalRole, PluginSharePrincipalType, PluginShareSaveResponse, PluginShareTarget,
    PluginShareTargetRole, PluginShareUpdateTargetsParams, PluginShareUpdateTargetsResponse,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::time::Duration;

pub(crate) const MAX_SHARE_BYTES: usize = 50 * 1024 * 1024;

#[derive(Deserialize)]
struct Upload {
    file_id: String,
    upload_url: String,
    etag: Option<String>,
}

#[derive(Deserialize)]
struct Saved {
    plugin_id: String,
    share_url: String,
    can_publish_to_workspace: Option<bool>,
}

#[derive(Deserialize)]
struct Updated {
    principals: Vec<wire::SharePrincipal>,
    discoverability: PluginShareDiscoverability,
}

impl Context<'_> {
    pub(crate) async fn save_share(
        &self,
        filename: String,
        bytes: Vec<u8>,
        remote_id: Option<&str>,
        discoverability: Option<PluginShareDiscoverability>,
        targets: Option<Vec<PluginShareTarget>>,
    ) -> Result<PluginShareSaveResponse, RuntimeCoreError> {
        if let Some(id) = remote_id {
            wire::validate_remote_id(id)?;
        }
        let mut body =
            json!({"filename":filename,"mime_type":"application/gzip","size_bytes":bytes.len()});
        if let Some(id) = remote_id {
            body["plugin_id"] = json!(id);
        }
        let upload: Upload = self
            .client_request(
                "public/plugins/workspace/upload-url",
                CloudRequestMethod::Post,
                Some(body),
            )
            .await?;
        let etag = upload
            .etag
            .filter(|etag| !etag.is_empty() && etag.len() <= 256)
            .ok_or_else(|| invalid("plugin share upload response did not include an etag"))?;
        if upload.file_id.is_empty() || upload.file_id.len() > 128 {
            return Err(invalid("invalid plugin share upload file id"));
        }
        self.upload_share(&upload.upload_url, bytes).await?;
        let targets = self.share_targets(discoverability, targets);
        let mut body = json!({"file_id":upload.file_id,"etag":etag});
        if let Some(discoverability) = discoverability {
            body["discoverability"] = json!(discoverability);
        }
        if let Some(targets) = targets {
            body["share_targets"] = targets;
        }
        let path = match remote_id {
            Some(id) => format!("public/plugins/workspace/{id}"),
            None => "public/plugins/workspace".into(),
        };
        let saved: Saved = self
            .client_request(&path, CloudRequestMethod::Post, Some(body))
            .await?;
        wire::validate_remote_id(&saved.plugin_id)
            .map_err(|_| invalid("invalid saved plugin share id"))?;
        if remote_id.is_some_and(|expected| expected != saved.plugin_id) {
            return Err(invalid("saved plugin share id does not match request"));
        }
        upload::validate_url(&saved.share_url, &self.account)?;
        Ok(PluginShareSaveResponse {
            remote_plugin_id: saved.plugin_id,
            share_url: saved.share_url,
            can_publish_to_workspace: saved.can_publish_to_workspace,
        })
    }

    fn share_targets(
        &self,
        discoverability: Option<PluginShareDiscoverability>,
        targets: Option<Vec<PluginShareTarget>>,
    ) -> Option<Value> {
        let mut targets = targets;
        if discoverability == Some(PluginShareDiscoverability::Unlisted) {
            let Account::Cloud { tenant_id, .. } = &self.account;
            let targets = targets.get_or_insert_with(Vec::new);
            if !targets.iter().any(|target| {
                target.principal_type == PluginSharePrincipalType::Workspace
                    && target.principal_id == *tenant_id
            }) {
                targets.push(PluginShareTarget {
                    principal_type: PluginSharePrincipalType::Workspace,
                    principal_id: tenant_id.clone(),
                    role: PluginShareTargetRole::Reader,
                });
            }
        }
        targets.map(|targets| Value::Array(targets.into_iter().map(|target| json!({"principal_type":target.principal_type,"principal_id":target.principal_id,"role":target.role})).collect()))
    }

    pub(crate) async fn update_share(
        &self,
        params: PluginShareUpdateTargetsParams,
    ) -> Result<PluginShareUpdateTargetsResponse, RuntimeCoreError> {
        wire::validate_remote_id(&params.remote_plugin_id)?;
        let discoverability: PluginShareDiscoverability =
            serde_json::from_value(json!(params.discoverability))
                .map_err(|_| invalid("invalid plugin share discoverability"))?;
        let targets = self.share_targets(Some(discoverability), Some(params.share_targets));
        let result: Updated = self
            .request(
                &format!("{}/shares", params.remote_plugin_id),
                CloudRequestMethod::Put,
                Some(json!({"discoverability":discoverability,"targets":targets})),
            )
            .await?;
        if result.discoverability != discoverability {
            return Err(invalid(
                "plugin share discoverability does not match request",
            ));
        }
        let Account::Cloud { user_id, .. } = &self.account;
        validate_principals(&result.principals, user_id)?;
        let principals = result
            .principals
            .into_iter()
            .map(|principal| PluginSharePrincipal {
                principal_type: principal.principal_type,
                principal_id: principal.principal_id,
                role: principal.role,
                name: principal.name,
            })
            .collect();
        Ok(PluginShareUpdateTargetsResponse {
            principals,
            discoverability: result.discoverability,
        })
    }

    pub(crate) async fn delete_share(&self, remote_id: &str) -> Result<(), RuntimeCoreError> {
        wire::validate_remote_id(remote_id)?;
        let response = self
            .client_response(
                &format!("public/plugins/workspace/{remote_id}"),
                CloudRequestMethod::Delete,
                None,
            )
            .await?;
        if response.status != 204 {
            return Err(invalid("plugin share delete requires HTTP 204"));
        }
        Ok(())
    }

    pub(crate) async fn created_shares(&self) -> Result<Vec<wire::Item>, RuntimeCoreError> {
        tokio::time::timeout(Duration::from_secs(30), async {
            let mut items = Vec::new();
            let mut ids = BTreeSet::new();
            let mut keys = BTreeSet::new();
            let mut cursors = BTreeSet::new();
            let mut cursor: Option<String> = None;
            for _ in 0..100 {
                let mut suffix = "workspace/created?limit=200".to_string();
                if let Some(cursor) = &cursor {
                    suffix.push_str("&pageToken=");
                    suffix.push_str(&urlencoding::encode(cursor));
                }
                let page: wire::Directory = self.get(&suffix).await?;
                for item in page.plugins {
                    item.validate(Some(wire::Scope::Workspace))?;
                    let Account::Cloud { user_id, .. } = &self.account;
                    if item.creator_account_user_id.as_deref() != Some(user_id)
                        || item.share_principals.is_none()
                        || !ids.insert(item.id.clone())
                        || !keys.insert((item.marketplace(), item.name.clone()))
                    {
                        return Err(invalid(
                            "invalid created plugin share identity or principals",
                        ));
                    }
                    validate_principals(
                        item.share_principals.as_deref().unwrap_or_default(),
                        user_id,
                    )?;
                    items.push(item);
                    if items.len() > 10_000 {
                        return Err(invalid("created plugin shares exceed limit"));
                    }
                }
                let Some(next) = page.pagination.next_page_token else {
                    self.ensure_current()?;
                    return Ok(items);
                };
                if next.is_empty() || next.len() > 4096 || !cursors.insert(next.clone()) {
                    return Err(invalid("invalid created plugin share cursor"));
                }
                cursor = Some(next);
            }
            Err(invalid("created plugin shares exceed page limit"))
        })
        .await
        .map_err(|_| invalid("created plugin shares timed out"))?
    }
}

fn validate_principals(
    principals: &[wire::SharePrincipal],
    creator: &str,
) -> Result<(), RuntimeCoreError> {
    let mut seen = BTreeSet::new();
    let mut owners = 0;
    for principal in principals {
        if principal.principal_id.is_empty()
            || !seen.insert((
                json!(principal.principal_type).to_string(),
                &principal.principal_id,
            ))
        {
            return Err(invalid("invalid plugin share principals"));
        }
        if principal.role == PluginSharePrincipalRole::Owner {
            owners += 1;
            if principal.principal_type != PluginSharePrincipalType::User
                || principal.principal_id != creator
            {
                return Err(invalid("invalid plugin share creator principal"));
            }
        }
    }
    if owners != 1 {
        return Err(invalid("invalid plugin share owner principals"));
    }
    Ok(())
}

fn invalid(message: &str) -> RuntimeCoreError {
    RuntimeCoreError::Backend(message.into())
}
