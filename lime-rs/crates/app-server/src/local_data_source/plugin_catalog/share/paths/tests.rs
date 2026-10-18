use super::*;

#[test]
fn share_paths_are_account_partitioned_and_survive_reload_without_touching_worktree() {
    let temp = tempfile::tempdir().unwrap();
    let store = PluginStore::new(temp.path().join("store"), temp.path().join("config.yaml"));
    let first = "a".repeat(64);
    let second = "b".repeat(64);
    let root = temp.path().join("editor");
    fs::create_dir(&root).unwrap();
    fs::write(root.join("keep.txt"), "user content").unwrap();
    let path = AbsolutePathBuf::try_from(root.clone()).unwrap();
    edit(&store, &first, "opaque~1", Some(path.clone())).unwrap();
    let cold = PluginStore::new(store.root.clone(), store.config_path.clone());
    assert_eq!(load(&cold, &first).unwrap().get("opaque~1"), Some(&path));
    assert!(load(&cold, &second).unwrap().is_empty());
    edit(&cold, &second, "opaque~1", Some(path)).unwrap();
    edit(&cold, &first, "opaque~1", None).unwrap();
    assert!(load(&cold, &first).unwrap().is_empty());
    assert!(!location(&cold, &first).unwrap().exists());
    assert_eq!(load(&cold, &second).unwrap().len(), 1);
    assert_eq!(
        fs::read_to_string(root.join("keep.txt")).unwrap(),
        "user content"
    );
    assert!(load(&store, "../escape").is_err());
}

#[test]
fn share_paths_serialize_concurrent_writers_and_recover_malformed_cache() {
    let temp = tempfile::tempdir().unwrap();
    let store = PluginStore::new(temp.path().join("store"), temp.path().join("config.yaml"));
    let identity = "c".repeat(64);
    let workers = (0..8)
        .map(|index| {
            let store = store.clone();
            let identity = identity.clone();
            std::thread::spawn(move || {
                edit(
                    &store,
                    &identity,
                    &format!("share-{index}"),
                    Some(
                        AbsolutePathBuf::try_from(store.root.join(format!("editor-{index}")))
                            .unwrap(),
                    ),
                )
                .unwrap()
            })
        })
        .collect::<Vec<_>>();
    for worker in workers {
        worker.join().unwrap();
    }
    assert_eq!(load(&store, &identity).unwrap().len(), 8);
    let cache = location(&store, &identity).unwrap();
    fs::write(&cache, "not-json").unwrap();
    assert!(load(&store, &identity).is_err());
    edit(
        &store,
        &identity,
        "fresh",
        Some(AbsolutePathBuf::try_from(store.root.join("fresh")).unwrap()),
    )
    .unwrap();
    assert_eq!(load(&store, &identity).unwrap().len(), 1);
    fs::write(&cache, vec![b' '; MAX_BYTES as usize + 1]).unwrap();
    assert!(load(&store, &identity).is_err());
}
