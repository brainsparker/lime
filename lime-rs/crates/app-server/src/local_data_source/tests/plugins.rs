use super::*;

#[tokio::test]
async fn plugin_skills_share_enabled_catalog_and_only_successful_mutations_broadcast() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("source");
    fs::create_dir_all(source.join("skills/plugin-proof")).unwrap();
    fs::write(
        source.join("plugin.json"),
        r#"{
        "$schema":"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        "name":"catalog-proof", "version":"1.0.0"
    }"#,
    )
    .unwrap();
    fs::write(
        source.join("skills/plugin-proof/SKILL.md"),
        "---\nname: plugin-proof\ndescription: Plugin catalog proof\n---\n",
    )
    .unwrap();
    let marketplace = temp.path().join(".agents/plugins/marketplace.json");
    fs::create_dir_all(marketplace.parent().unwrap()).unwrap();
    fs::write(
        &marketplace,
        serde_json::to_vec(&json!({
            "name": "local", "plugins": [{"name": "catalog-proof", "source": "./source"}]
        }))
        .unwrap(),
    )
    .unwrap();
    let mut data_source = setup_data_source();
    data_source.app_data_root = temp.path().join("app");
    data_source.plugin_store.root = temp.path().join("plugins");
    data_source = data_source.with_app_config_path(temp.path().join("config.yaml"));
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_app_config_path(temp.path().join("config.yaml"))
            .with_app_data_source(Arc::new(data_source)),
    );
    app_server_request(
        &server,
        1,
        METHOD_INITIALIZE,
        json!({
            "clientInfo":{"name":"plugin-skills", "version":"1"},
            "capabilities":{"experimentalApi":true}
        }),
    )
    .await;
    app_server_notification(&server, METHOD_INITIALIZED, json!({})).await;
    let mut outbound = server.subscribe_outbound_messages();
    for (method, params) in [
        (
            "plugin/install",
            json!({"marketplacePath":marketplace, "pluginName":"absent"}),
        ),
        (
            "plugin/enabled/set",
            json!({"pluginId":"absent", "enabled":false}),
        ),
        (
            "config/batchWrite",
            json!({"edits":[{"keyPath":"plugins.\"catalog-proof@local\".enabled", "value":"false", "mergeStrategy":"replace"}]}),
        ),
    ] {
        let response = app_server_request(&server, 2, method, params).await;
        assert!(response.get("error").is_some(), "{response}");
        assert!(
            outbound.try_recv().is_err(),
            "failed mutation must not broadcast"
        );
    }
    for (method, params, present) in [
        (
            "plugin/install",
            json!({"marketplacePath":marketplace, "pluginName":"catalog-proof"}),
            true,
        ),
        (
            "config/batchWrite",
            json!({"edits":[{"keyPath":"plugins.\"catalog-proof@local\".enabled", "value":false, "mergeStrategy":"replace"}]}),
            false,
        ),
        (
            "config/batchWrite",
            json!({"edits":[{"keyPath":"plugins.\"catalog-proof@local\".enabled", "value":true, "mergeStrategy":"replace"}]}),
            true,
        ),
        (
            "plugin/uninstall",
            json!({"pluginId":"catalog-proof@local"}),
            false,
        ),
    ] {
        let response = app_server_request(&server, 3, method, params).await;
        assert!(response.get("result").is_some(), "{response}");
        let mut changes = 0;
        while let Ok(message) = outbound.try_recv() {
            if matches!(message, app_server_protocol::JsonRpcMessage::Notification(notification)
                if notification.method == "skills/changed")
            {
                changes += 1;
            }
        }
        assert_eq!(changes, 1, "{method} must broadcast once");
        let catalog = app_server_request(
            &server,
            4,
            "skills/list",
            json!({
                "cwds":[temp.path()], "forceReload":false
            }),
        )
        .await;
        let skills = catalog["result"]["data"][0]["skills"]
            .as_array()
            .expect("Skills catalog");
        let skill = skills
            .iter()
            .find(|skill| skill["name"] == "catalog-proof:plugin-proof");
        assert_eq!(skill.is_some(), present, "{method}: {catalog}");
        if let Some(skill) = skill {
            assert_eq!(skill["description"], "Plugin catalog proof");
            assert_eq!(skill["enabled"], true);
        }
    }
}
