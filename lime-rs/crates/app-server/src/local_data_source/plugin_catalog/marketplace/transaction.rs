use super::*;

#[derive(Clone, Copy)]
pub(super) enum SnapshotEdit<'a> {
    Keep,
    Replace(&'a Path),
    Remove,
}

/// 网络和解析在锁外完成；提交时重读配置，只写选中的市场并保留并发无关编辑。
pub(super) fn commit(
    store: &PluginStore,
    name: &str,
    expected: Option<&MarketplaceConfig>,
    next: Option<MarketplaceConfig>,
    edit: SnapshotEdit<'_>,
) -> Result<bool, Error> {
    commit_using(store, name, expected, next, edit, |manager| {
        manager.save().map_err(internal)
    })
}

pub(super) fn commit_using(
    store: &PluginStore,
    name: &str,
    expected: Option<&MarketplaceConfig>,
    next: Option<MarketplaceConfig>,
    edit: SnapshotEdit<'_>,
    save: impl FnOnce(&ConfigManager) -> Result<(), Error>,
) -> Result<bool, Error> {
    let _guard = lime_core::config::config_file_lock();
    let mut manager = ConfigManager::load(&store.config_path).map_err(internal)?;
    if manager.config().marketplaces.get(name) != expected {
        return Err(invalid(format!(
            "marketplace '{name}' changed while operation was in flight"
        )));
    }
    if next.is_some() && expected.is_none() {
        reject_name_conflict(&manager.config().marketplaces, name)?;
    }
    let destination = install_root(store)?.join(name);
    let had_root = fs::symlink_metadata(&destination).is_ok();
    if matches!(edit, SnapshotEdit::Replace(_)) && expected.is_none() && had_root {
        return Err(invalid(format!(
            "marketplace '{name}' already has an installed snapshot"
        )));
    }
    let changes_root = !matches!(edit, SnapshotEdit::Keep);
    let backup = if changes_root && had_root {
        let backup = staging(store)?;
        fs::rename(&destination, backup.path().join("root")).map_err(internal)?;
        Some(backup)
    } else {
        None
    };
    let result = (|| {
        if let SnapshotEdit::Replace(staged) = edit {
            fs::rename(staged, &destination).map_err(internal)?;
        }
        if let Some(next) = next {
            manager
                .config_mut()
                .marketplaces
                .insert(name.to_string(), next);
        } else {
            manager.config_mut().marketplaces.remove(name);
        }
        save(&manager)
    })();
    if let Err(error) = result {
        if matches!(edit, SnapshotEdit::Replace(_)) && destination.exists() {
            if let Err(rollback) = fs::remove_dir_all(&destination) {
                // Preserve the previous snapshot even when rollback itself cannot complete.
                let backup = backup.map(tempfile::TempDir::keep);
                return Err(internal(format!(
                    "{error}; rollback failed: {rollback}; previous snapshot: {backup:?}"
                )));
            }
        }
        if let Some(backup) = backup {
            if let Err(rollback) = fs::rename(backup.path().join("root"), &destination) {
                let preserved = backup.keep();
                return Err(internal(format!(
                    "{error}; rollback failed: {rollback}; previous snapshot: {}",
                    preserved.display()
                )));
            }
        }
        return Err(error);
    }
    Ok(changes_root && had_root)
}
