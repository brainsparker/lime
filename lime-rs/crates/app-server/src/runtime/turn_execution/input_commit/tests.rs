use super::*;

#[tokio::test]
async fn admitted_candidate_never_delivers_its_input_to_a_different_actor_turn() {
    let runtime = RuntimeCore::default();
    let session = runtime
        .start_session(AgentSessionStartParams {
            session_id: Some("candidate-session".to_string()),
            thread_id: Some("candidate-thread".to_string()),
            app_id: "test".to_string(),
            workspace_id: None,
            business_object_ref: None,
            locale: None,
        })
        .unwrap()
        .session;
    let actor = runtime
        .session_loop_for_input(&session.session_id, &session.thread_id)
        .await
        .unwrap();
    let (sender, receiver) = oneshot::channel();
    let sender = Arc::new(Mutex::new(Some(sender)));
    actor
        .submit(
            Arc::new(RuntimeSessionClosureTask::new(
                "other-turn",
                Vec::new(),
                move |context, _, cancellation| {
                    let sender = sender.clone();
                    Box::pin(async move {
                        assert!(sender
                            .lock()
                            .unwrap()
                            .take()
                            .unwrap()
                            .send(context.input_handle())
                            .is_ok());
                        cancellation.cancelled().await;
                        Ok(())
                    })
                },
            )),
            false,
        )
        .await
        .unwrap();
    let input = tokio::time::timeout(std::time::Duration::from_secs(3), receiver)
        .await
        .unwrap()
        .unwrap();
    let turn = AgentTurn {
        turn_id: "candidate-turn".to_string(),
        session_id: session.session_id.clone(),
        thread_id: session.thread_id.clone(),
        status: AgentTurnStatus::Accepted,
        started_at: None,
        completed_at: None,
    };
    {
        let mut state = runtime.state.lock().unwrap();
        let stored = state.sessions.get_mut(&session.session_id).unwrap();
        stored.turns.push(turn.clone());
        stored.turn_inputs.insert(
            turn.turn_id.clone(),
            vec![agent_protocol::AgentInput::text("candidate-only")],
        );
    }
    let request = ExecutionRequest {
        host: RuntimeHostContext::default(),
        session,
        turn,
        forked_from_thread_id: None,
        is_root_agent: false,
        input: agent_runtime::reply_input::RuntimeReplyInput::text("candidate-only"),
        runtime_options: None,
        expected_output: None,
        structured_output: None,
        output_schema: None,
        event_name: None,
        queued_turn_id: None,
        queue_if_busy: false,
        skip_pre_submit_resume: false,
        agent_control_gateway: None,
        command_publisher: None,
        rollout_budget_reminder_source: None,
        mid_turn_compaction_commit: None,
        internal_agent_policy: None,
    };
    let result = runtime
        .submit_backend_via_session_loop(request, ProviderTurnHistory::default())
        .await;
    assert!(
        matches!(result, Err(RuntimeCoreError::TurnAlreadyActive(id)) if id == "candidate-turn")
    );
    assert!(
        input
            .try_take_pending_input(false)
            .await
            .unwrap()
            .is_empty(),
        "a rejected candidate must not leak into other-turn"
    );
    actor.interrupt().await.unwrap();
}
