use super::*;

fn store(temp: &tempfile::TempDir) -> PluginStore {
    let mut store = PluginStore::new(
        temp.path().join("agent/plugins"),
        temp.path().join("config.yaml"),
    );
    store.home = None;
    store.bundled_marketplace = None;
    store
}

fn market(root: &Path, name: &str) {
    let manifest = root.join(".agents/plugins/marketplace.json");
    fs::create_dir_all(manifest.parent().unwrap()).unwrap();
    fs::write(
        manifest,
        serde_json::json!({"name": name, "plugins": []}).to_string(),
    )
    .unwrap();
}

#[tokio::test]
async fn local_marketplace_is_a_persistent_reference_and_remove_preserves_source_and_plugins() {
    let temp = tempfile::TempDir::new().unwrap();
    let store = store(&temp);
    let root = temp.path().join("source");
    market(&root, "work");
    let params = MarketplaceAddParams {
        source: root.to_string_lossy().into_owned(),
        ref_name: None,
        sparse_paths: None,
    };
    let first = add(&store, params.clone()).await.unwrap();
    assert_eq!(
        first,
        MarketplaceAddResponse {
            marketplace_name: "work".into(),
            installed_root: fs::canonicalize(&root).unwrap(),
            already_added: false
        }
    );
    assert!(add(&store, params).await.unwrap().already_added);
    let restored = PluginStore {
        root: store.root.clone(),
        config_path: store.config_path.clone(),
        home: None,
        bundled_marketplace: None,
        account: None,
    };
    assert_eq!(
        configured_paths(&restored).unwrap(),
        vec![first
            .installed_root
            .join(".agents/plugins/marketplace.json")]
    );
    let installed = store.root.join("cache/work/plugin/1.0.0");
    fs::create_dir_all(&installed).unwrap();
    fs::write(installed.join("retained"), "installed package").unwrap();
    assert_eq!(
        remove(
            &store,
            MarketplaceRemoveParams {
                marketplace_name: "work".into()
            }
        )
        .unwrap(),
        MarketplaceRemoveResponse {
            marketplace_name: "work".into(),
            installed_root: None
        }
    );
    assert!(root.join(".agents/plugins/marketplace.json").is_file());
    assert!(installed.join("retained").is_file());
    assert!(configured_paths(&restored).unwrap().is_empty());
    assert!(remove(
        &store,
        MarketplaceRemoveParams {
            marketplace_name: "work".into()
        }
    )
    .is_err());
}

#[tokio::test]
async fn conflicting_sources_case_and_failed_add_do_not_overwrite_configuration() {
    let temp = tempfile::TempDir::new().unwrap();
    let store = store(&temp);
    for directory in ["one", "two"] {
        market(&temp.path().join(directory), "same");
    }
    add(
        &store,
        MarketplaceAddParams {
            source: temp.path().join("one").to_string_lossy().into_owned(),
            ref_name: None,
            sparse_paths: None,
        },
    )
    .await
    .unwrap();
    let before = fs::read(&store.config_path).unwrap();
    assert!(add(
        &store,
        MarketplaceAddParams {
            source: temp.path().join("two").to_string_lossy().into_owned(),
            ref_name: None,
            sparse_paths: None
        }
    )
    .await
    .is_err());
    assert!(remove(
        &store,
        MarketplaceRemoveParams {
            marketplace_name: "SAME".into()
        }
    )
    .is_err());
    assert_eq!(fs::read(&store.config_path).unwrap(), before);
    market(&temp.path().join("two"), "../unsafe");
    assert!(add(
        &store,
        MarketplaceAddParams {
            source: temp.path().join("two").to_string_lossy().into_owned(),
            ref_name: None,
            sparse_paths: None
        }
    )
    .await
    .is_err());
    assert_eq!(fs::read(&store.config_path).unwrap(), before);
}

#[test]
fn source_forms_normalize_and_reject_non_git_options_without_network() {
    let shorthand =
        source::parse("owner/repo@main", None, vec!["plugins/foo".into()], None).unwrap();
    let url = source::parse(
        "https://github.com/owner/repo#main",
        None,
        vec!["plugins/foo".into()],
        None,
    )
    .unwrap();
    assert!(source::same_source(&shorthand, &url));
    assert_eq!(
        source::parse("owner/repo@main", Some("release".into()), vec![], None)
            .unwrap()
            .ref_name
            .as_deref(),
        Some("release")
    );
    for input in ["", "file:///tmp/repo", "not-a-source", "-option"] {
        assert!(source::parse(input, None, vec![], None).is_err(), "{input}");
    }
    assert!(source::parse(".", Some("main".into()), vec![], None).is_err());
    assert!(source::parse(".", None, vec!["plugins".into()], None).is_err());
    assert!(source::parse("owner/repo", Some("--detach".into()), vec![], None).is_err());
    assert!(source::parse("owner/repo", None, vec!["../escape".into()], None).is_err());
}

#[test]
fn concurrent_configuration_edit_prevents_snapshot_activation() {
    let temp = tempfile::TempDir::new().unwrap();
    let store = store(&temp);
    let expected = source::parse("owner/repo", None, vec![], None).unwrap();
    transaction::commit(
        &store,
        "work",
        None,
        Some(expected.clone()),
        transaction::SnapshotEdit::Keep,
    )
    .unwrap();
    let changed = source::parse("other/repo", None, vec![], None).unwrap();
    transaction::commit(
        &store,
        "work",
        Some(&expected),
        Some(changed.clone()),
        transaction::SnapshotEdit::Keep,
    )
    .unwrap();
    let destination = install_root(&store).unwrap().join("work");
    market(&destination, "work");
    fs::write(destination.join("previous"), "keep").unwrap();
    let staged = staging(&store).unwrap();
    market(staged.path(), "work");
    assert!(transaction::commit(
        &store,
        "work",
        Some(&expected),
        Some(expected.clone()),
        transaction::SnapshotEdit::Replace(staged.path())
    )
    .is_err());
    assert!(destination.join("previous").exists());
    assert_eq!(config(&store).unwrap()["work"], changed);
}

#[test]
fn failed_config_commit_restores_previous_snapshot_and_keeps_unrelated_edits() {
    let temp = tempfile::TempDir::new().unwrap();
    let store = store(&temp);
    let expected = source::parse("owner/repo", None, vec![], None).unwrap();
    transaction::commit(
        &store,
        "work",
        None,
        Some(expected.clone()),
        transaction::SnapshotEdit::Keep,
    )
    .unwrap();
    let destination = install_root(&store).unwrap().join("work");
    market(&destination, "work");
    fs::write(destination.join("previous"), "previous snapshot").unwrap();
    let before = fs::read(&store.config_path).unwrap();
    for remove in [false, true] {
        let staged = staging(&store).unwrap();
        market(staged.path(), "work");
        fs::write(staged.path().join("new"), "new snapshot").unwrap();
        let edit = if remove {
            transaction::SnapshotEdit::Remove
        } else {
            transaction::SnapshotEdit::Replace(staged.path())
        };
        let error = transaction::commit_using(&store, "work", Some(&expected), None, edit, |_| {
            assert!(!destination.join("previous").exists());
            Err(internal("injected atomic config write failure"))
        })
        .unwrap_err();
        assert!(error.to_string().contains("injected"));
        assert_eq!(
            fs::read(destination.join("previous")).unwrap(),
            b"previous snapshot"
        );
        assert!(!destination.join("new").exists());
        assert_eq!(fs::read(&store.config_path).unwrap(), before);
    }
}
