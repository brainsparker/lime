use super::*;
use crate::reply_input::RuntimeReplyInput;
use futures::FutureExt;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

async fn fixture() -> (RuntimeSessionHandle, RuntimeSessionInputHandle) {
    let registry = RuntimeSessionRegistry::default();
    let actor = registry
        .get_or_create("input-commit", "input-thread")
        .await
        .unwrap();
    let (sender, receiver) = oneshot::channel();
    let sender = Arc::new(std::sync::Mutex::new(Some(sender)));
    actor
        .submit(
            Arc::new(RuntimeSessionClosureTask::new(
                "input-turn",
                Vec::new(),
                move |context, _, cancel| {
                    let sender = sender.clone();
                    Box::pin(async move {
                        assert!(sender
                            .lock()
                            .unwrap()
                            .take()
                            .unwrap()
                            .send(context.input_handle())
                            .is_ok());
                        cancel.cancelled().await;
                        Ok(())
                    })
                },
            )),
            false,
        )
        .await
        .unwrap();
    let input = timeout(Duration::from_secs(3), receiver)
        .await
        .unwrap()
        .unwrap();
    (actor, input)
}

fn user() -> Vec<RuntimeSessionInput> {
    vec![RuntimeSessionInput::User(RuntimeReplyInput::text(
        "same input",
    ))]
}

#[tokio::test]
async fn committed_continuation_reopens_the_same_turn_for_durable_steer() {
    let (actor, input) = fixture().await;
    input.mark_mailbox_delivery_for_next_turn().await;
    assert!(input.mark_finishing().await);
    assert!(matches!(
        actor
            .steer_for_turn_id_with_metadata(Some("input-turn"), user(), None, None, None,)
            .await,
        Err(RuntimeSessionLoopError::InvalidTask(_))
    ));
    input.resume_sampling().await;
    assert_eq!(
        input.mailbox_delivery_phase().await,
        RuntimeSessionMailboxDeliveryPhase::CurrentTurn
    );
    let committed = Arc::new(AtomicUsize::new(0));
    let count = committed.clone();
    let commit = RuntimeSessionInputCommit::new(move |turn| {
        assert_eq!(turn, "input-turn");
        count.fetch_add(1, Ordering::SeqCst);
        Ok(())
    });
    assert_eq!(
        actor
            .steer_for_turn_id_with_metadata(Some("input-turn"), user(), None, None, Some(commit),)
            .await
            .unwrap(),
        "input-turn"
    );
    assert_eq!(committed.load(Ordering::SeqCst), 1);
    assert_eq!(input.try_take_pending_input(false).await.unwrap().len(), 1);
    assert!(input.mark_finishing().await);
    actor.interrupt().await.unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 3)]
async fn durable_commit_is_a_barrier_for_consumption_and_finishing() {
    assert_commit_barrier(false).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 3)]
async fn failed_commit_releases_the_barrier_without_delivery_or_mailbox_reopen() {
    assert_commit_barrier(true).await;
}

async fn assert_commit_barrier(fail: bool) {
    let (actor, input) = fixture().await;
    input.mark_mailbox_delivery_for_next_turn().await;
    let (entered, entered_rx) = oneshot::channel();
    let entered = std::sync::Mutex::new(Some(entered));
    let (release, release_rx) = std::sync::mpsc::channel();
    let release_rx = std::sync::Mutex::new(release_rx);
    let commit = RuntimeSessionInputCommit::new(move |turn_id| {
        assert_eq!(turn_id, "input-turn");
        entered.lock().unwrap().take().unwrap().send(()).unwrap();
        release_rx
            .lock()
            .unwrap()
            .recv_timeout(std::time::Duration::from_secs(3))
            .unwrap();
        if fail {
            Err("durable write failed".to_string())
        } else {
            Ok(())
        }
    });
    let sender = actor.clone();
    let admission = tokio::spawn(async move {
        sender
            .steer_for_turn_id_with_metadata(Some("input-turn"), user(), None, None, Some(commit))
            .await
    });
    timeout(Duration::from_secs(3), entered_rx)
        .await
        .unwrap()
        .unwrap();
    // 不靠 sleep：已进入 commit 后，两个真实消费者都必须被同一输入 guard 挡住。
    assert!(input.try_take_pending_input(false).now_or_never().is_none());
    assert!(input.mark_finishing().now_or_never().is_none());
    release.send(()).unwrap();
    let result = timeout(Duration::from_secs(3), admission)
        .await
        .unwrap()
        .unwrap();
    if fail {
        assert!(
            matches!(result, Err(RuntimeSessionLoopError::OperationFailed(message)) if message == "durable write failed")
        );
        assert_eq!(
            input.mailbox_delivery_phase().await,
            RuntimeSessionMailboxDeliveryPhase::NextTurn
        );
        assert!(input
            .try_take_pending_input(false)
            .await
            .unwrap()
            .is_empty());
    } else {
        assert_eq!(result.unwrap(), "input-turn");
        assert_eq!(
            input.mailbox_delivery_phase().await,
            RuntimeSessionMailboxDeliveryPhase::CurrentTurn
        );
        assert!(!input.mark_finishing().await);
        let pending = input.try_take_pending_input(false).await.unwrap();
        assert_eq!(pending.len(), 1);
        let RuntimeSessionInput::User(pending) = &pending[0] else {
            panic!("expected user input")
        };
        assert_eq!(pending.concat_text(), "same input");
    }
    actor.interrupt().await.unwrap();
}

#[tokio::test]
async fn invalid_target_and_finishing_turn_never_run_the_commit() {
    let (actor, input) = fixture().await;
    let calls = Arc::new(AtomicUsize::new(0));
    let count = calls.clone();
    let commit = RuntimeSessionInputCommit::new(move |_| {
        count.fetch_add(1, Ordering::SeqCst);
        Ok(())
    });
    let wrong = actor
        .steer_for_turn_id_with_metadata(
            Some("wrong-turn"),
            user(),
            None,
            None,
            Some(commit.clone()),
        )
        .await;
    assert!(matches!(
        wrong,
        Err(RuntimeSessionLoopError::InvalidTask(_))
    ));
    assert!(input.mark_finishing().await);
    let finishing = actor
        .steer_for_turn_id_with_metadata(Some("input-turn"), user(), None, None, Some(commit))
        .await;
    assert!(matches!(
        finishing,
        Err(RuntimeSessionLoopError::InvalidTask(_))
    ));
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert!(input
        .try_take_pending_input(false)
        .await
        .unwrap()
        .is_empty());
    actor.interrupt().await.unwrap();
}
