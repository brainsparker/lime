use super::*;
use agent_protocol::{SortDirection, ThreadTurnsView, TurnItemsView};
use std::collections::HashSet;
use std::future::Future;
use thread_store::{ItemPage, ListItemsParams, ListTurnsParams, TurnPage};

struct HistoryPage<T> {
    data: Vec<T>,
    next_cursor: Option<StoreCursor>,
    backwards_cursor: Option<StoreCursor>,
}

impl From<TurnPage> for HistoryPage<agent_protocol::Turn> {
    fn from(page: TurnPage) -> Self {
        Self {
            data: page.data,
            next_cursor: page.next_cursor,
            backwards_cursor: page.backwards_cursor,
        }
    }
}

impl From<ItemPage> for HistoryPage<agent_protocol::ThreadItem> {
    fn from(page: ItemPage) -> Self {
        Self {
            data: page.data,
            next_cursor: page.next_cursor,
            backwards_cursor: page.backwards_cursor,
        }
    }
}

// Queue records remain durable internal facts until admission. Public history
// fills visible pages while leaving cursor interpretation to the store.
async fn visible_page<T, Fetch, Read>(
    mut request: PageRequest,
    mut fetch: Fetch,
    is_visible: impl Fn(&T) -> bool,
) -> Result<HistoryPage<T>, RuntimeCoreError>
where
    Fetch: FnMut(PageRequest) -> Read,
    Read: Future<Output = Result<HistoryPage<T>, RuntimeCoreError>>,
{
    let limit = request.limit;
    let mut data = Vec::new();
    let mut backwards_cursor = None;
    let mut boundary_cursor = None;
    let mut seen = HashSet::new();
    if let Some(cursor) = request.cursor.as_ref() {
        seen.insert(cursor.clone());
    }
    loop {
        // The first request preserves the caller's limit validation. Subsequent
        // reads cannot overfill the visible page, so no cursor is synthesized.
        let page = fetch(request.clone()).await?;
        if let Some(cursor) = page.next_cursor.as_ref() {
            if !seen.insert(cursor.clone()) {
                return Err(RuntimeCoreError::Backend(
                    "history store repeated a pagination cursor".to_string(),
                ));
            }
        }
        let visible = page
            .data
            .into_iter()
            .filter(&is_visible)
            .collect::<Vec<_>>();
        if data.len() == limit as usize {
            if !visible.is_empty() {
                return Ok(HistoryPage {
                    data,
                    next_cursor: boundary_cursor,
                    backwards_cursor,
                });
            }
        } else {
            if data.is_empty() && !visible.is_empty() {
                backwards_cursor = page.backwards_cursor;
            }
            data.extend(visible);
            if data.len() == limit as usize {
                boundary_cursor = page.next_cursor.clone();
            }
        }
        let Some(cursor) = page.next_cursor else {
            return Ok(HistoryPage {
                data,
                next_cursor: None,
                backwards_cursor,
            });
        };
        request.cursor = Some(cursor);
        // Peek beyond a filled page without consuming its continuation. A tail
        // containing only pending submissions is EOF for execution history.
        request.limit = if data.len() == limit as usize {
            limit
        } else {
            limit - data.len() as u32
        };
    }
}

impl RuntimeCore {
    pub async fn list_thread_turns(
        &self,
        params: ThreadTurnsListParams,
    ) -> Result<ThreadTurnsListResponse, RuntimeCoreError> {
        let store = self.canonical_thread_store()?;
        let thread_id = params.thread_id;
        let items_view = params.items_view;
        let mut page = visible_page(
            store_page(params.page)?,
            |page| {
                let thread_id = thread_id.clone();
                async move {
                    store
                        .list_turns(ListTurnsParams {
                            thread_id,
                            include_archived: true,
                            page,
                            items_view,
                        })
                        .await
                        .map(HistoryPage::from)
                        .map_err(store_error)
                }
            },
            |turn| !is_queued_turn(turn),
        )
        .await?;
        let execution = self.thread_execution_state(thread_id.as_str()).await?;
        normalize_turn_runtime_snapshots(&mut page.data, &execution);
        Ok(ThreadTurnsListResponse {
            data: page.data,
            next_cursor: page.next_cursor.map(StoreCursor::into_string),
            backwards_cursor: page.backwards_cursor.map(StoreCursor::into_string),
        })
    }

    pub async fn list_thread_items(
        &self,
        params: ThreadItemsListParams,
    ) -> Result<ThreadItemsListResponse, RuntimeCoreError> {
        let store = self.canonical_thread_store()?;
        let thread_id = params.thread_id;
        let queued = store
            .read_thread(ReadThreadParams {
                thread_id: thread_id.clone(),
                include_archived: true,
                turns_view: ThreadTurnsView::Summary,
            })
            .await
            .map_err(store_error)?
            .ok_or_else(|| {
                RuntimeCoreError::InvalidRequest(format!("thread not found: {thread_id}"))
            })?
            .turns
            .into_iter()
            .filter(is_queued_turn)
            .map(|turn| turn.turn_id)
            .collect::<HashSet<_>>();
        let turn_id = params.turn_id;
        let page = visible_page(
            store_page(params.page)?,
            |page| {
                let thread_id = thread_id.clone();
                let turn_id = turn_id.clone();
                async move {
                    store
                        .list_items(ListItemsParams {
                            thread_id,
                            turn_id,
                            include_archived: true,
                            page,
                        })
                        .await
                        .map(HistoryPage::from)
                        .map_err(store_error)
                }
            },
            |item| !queued.contains(&item.turn_id),
        )
        .await?;
        Ok(ThreadItemsListResponse {
            data: page.data,
            next_cursor: page.next_cursor.map(StoreCursor::into_string),
            backwards_cursor: page.backwards_cursor.map(StoreCursor::into_string),
        })
    }

    pub(crate) async fn paginated_resume_backwards_cursors(
        &self,
        thread_id: agent_protocol::ThreadId,
    ) -> Result<(Option<String>, Option<String>), RuntimeCoreError> {
        let page = PageCursor {
            cursor: None,
            limit: Some(1),
            sort_direction: SortDirection::Desc,
        };
        let turns = self
            .list_thread_turns(ThreadTurnsListParams {
                thread_id: thread_id.clone(),
                page: page.clone(),
                items_view: TurnItemsView::NotLoaded,
            })
            .await?;
        let items = self
            .list_thread_items(ThreadItemsListParams {
                thread_id,
                turn_id: None,
                page,
            })
            .await?;
        Ok((turns.backwards_cursor, items.backwards_cursor))
    }
}

#[cfg(test)]
mod tests;
