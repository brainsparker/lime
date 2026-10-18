use super::{wire::Item, wire::Pagination, Context};
use crate::runtime::RuntimeCoreError;
use serde::Deserialize;
use std::collections::BTreeSet;
use std::time::Duration;

#[derive(Deserialize)]
pub(crate) struct Installed {
    #[serde(flatten)]
    pub plugin: Item,
    pub enabled: bool,
    pub installed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
struct Page {
    plugins: Vec<Installed>,
    pagination: Pagination,
}

impl Context<'_> {
    /// `/installed` is an authoritative snapshot: never publish a partial page set.
    pub(crate) async fn installed(&self) -> Result<Vec<Installed>, RuntimeCoreError> {
        self.installed_snapshot(true).await
    }

    pub(crate) async fn installed_snapshot(
        &self,
        include_download_urls: bool,
    ) -> Result<Vec<Installed>, RuntimeCoreError> {
        tokio::time::timeout(Duration::from_secs(30), async {
            let mut rows = Vec::new();
            let mut cursor: Option<String> = None;
            let mut cursors = BTreeSet::new();
            let mut ids = BTreeSet::new();
            let mut keys = BTreeSet::new();
            for _ in 0..100 {
                let mut suffix =
                    format!("installed?limit=200&includeDownloadUrls={include_download_urls}");
                if let Some(cursor) = &cursor {
                    suffix.push_str("&pageToken=");
                    suffix.push_str(&urlencoding::encode(cursor));
                }
                let page: Page = self.get(&suffix).await?;
                for row in page.plugins {
                    row.plugin.validate(None)?;
                    let key = (row.plugin.marketplace(), row.plugin.name.clone());
                    if !ids.insert(row.plugin.id.clone()) || !keys.insert(key) {
                        return Err(invalid_snapshot("duplicate installed plugin identity"));
                    }
                    rows.push(row);
                    if rows.len() > 10_000 {
                        return Err(invalid_snapshot("installed plugin snapshot exceeds limit"));
                    }
                }
                let Some(next) = page.pagination.next_page_token else {
                    self.ensure_current()?;
                    return Ok(rows);
                };
                if next.is_empty() || next.len() > 4096 || !cursors.insert(next.clone()) {
                    return Err(invalid_snapshot("invalid installed plugin page cursor"));
                }
                cursor = Some(next);
            }
            Err(invalid_snapshot(
                "installed plugin snapshot exceeds page limit",
            ))
        })
        .await
        .map_err(|_| invalid_snapshot("installed plugin snapshot timed out"))?
    }
}

fn invalid_snapshot(message: &str) -> RuntimeCoreError {
    RuntimeCoreError::Backend(message.to_string())
}
