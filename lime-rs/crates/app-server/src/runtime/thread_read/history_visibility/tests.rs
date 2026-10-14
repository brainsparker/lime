use super::*;

#[tokio::test]
async fn repeated_opaque_cursor_fails_instead_of_looping_or_losing_history() {
    let request = PageRequest {
        cursor: Some(StoreCursor::new("same-cursor").unwrap()),
        limit: 2,
        sort_direction: SortDirection::Asc,
    };
    let error = visible_page(
        request,
        |_| async {
            Ok(HistoryPage {
                data: vec![false],
                next_cursor: Some(StoreCursor::new("same-cursor").unwrap()),
                backwards_cursor: None,
            })
        },
        |visible| *visible,
    )
    .await
    .err()
    .expect("repeated cursor must fail");
    assert!(error.to_string().contains("repeated a pagination cursor"));
}

#[tokio::test]
async fn lookahead_errors_do_not_claim_a_complete_visible_page() {
    let mut reads = 0;
    let request = PageRequest {
        cursor: None,
        limit: 1,
        sort_direction: SortDirection::Desc,
    };
    let error = visible_page(
        request,
        |_| {
            reads += 1;
            let fail = reads > 1;
            async move {
                if fail {
                    return Err(RuntimeCoreError::Backend("read failed".to_string()));
                }
                Ok(HistoryPage {
                    data: vec![true],
                    next_cursor: Some(StoreCursor::new("unread-page").unwrap()),
                    backwards_cursor: None,
                })
            }
        },
        |visible| *visible,
    )
    .await
    .err()
    .expect("lookahead failure must propagate");
    assert_eq!(reads, 2);
    assert!(error.to_string().contains("read failed"));
}
