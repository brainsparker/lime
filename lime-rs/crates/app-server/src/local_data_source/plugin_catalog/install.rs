use super::*;

pub(crate) fn install(
    store: &PluginStore,
    params: PluginInstallParams,
) -> Result<PluginInstallResponse, String> {
    let (marketplace, index) = resolve_plugin(
        params.marketplace_path.as_deref(),
        params.remote_marketplace_name.as_deref(),
        &params.plugin_name,
    )?;
    let entry = &marketplace.plugins[index];
    if entry.install_policy == PluginInstallPolicy::NotAvailable {
        return Err(format!("Plugin 不允许安装: {}", entry.id.key()));
    }
    let source_root = entry.root.clone();
    let manifest = manifest::read_manifest_with_name(&source_root, Some(&entry.id.name))?;
    let id = entry.id.clone();
    let version = manifest_version(&manifest)?;
    let digest = package_digest(&source_root)?;
    let base = store.base_root(&id);
    if source_root.starts_with(fs::canonicalize(&store.root).unwrap_or_else(|_| store.root.clone()))
    {
        return Err("Plugin source 不能位于 installed cache 内。".to_string());
    }
    let parent = base.parent().expect("plugin base parent");
    fs::create_dir_all(parent).map_err(io_error("创建 Plugin cache 失败"))?;
    let staging = tempfile::Builder::new()
        .prefix(".plugin-stage-")
        .tempdir_in(parent)
        .map_err(io_error("创建 Plugin staging 失败"))?;
    let staged_base = staging.path().join(&id.name);
    let staged_version = staged_base.join(&version);
    fs::create_dir_all(&staged_version).map_err(io_error("创建 Plugin version 失败"))?;
    copy_package_tree(&source_root, &staged_version)?;
    let staged = manifest::read_manifest_with_name(&staged_version, Some(&id.name))?;
    if manifest_name(&staged)? != id.name || package_digest(&staged_version)? != digest {
        return Err("Plugin staging identity 或 digest 不一致。".to_string());
    }
    let components = build_capability_detail(&staged_version, &staged)?;
    let backup = staging.path().join("backup");
    let had_previous = base.exists();
    if had_previous {
        fs::rename(&base, &backup).map_err(io_error("暂存 Plugin cache 失败"))?;
    }
    if let Err(error) = fs::rename(&staged_base, &base) {
        if had_previous {
            fs::rename(&backup, &base).map_err(|rollback| {
                format!("Plugin cache 提交失败: {error}; 回滚失败: {rollback}")
            })?;
        }
        return Err(format!("提交 Plugin cache 失败: {error}"));
    }
    if let Err(error) = store.set_enabled(&id, true) {
        fs::remove_dir_all(&base).map_err(io_error("回滚 Plugin cache 失败"))?;
        if had_previous {
            fs::rename(&backup, &base).map_err(io_error("恢复 Plugin cache 失败"))?;
        }
        return Err(error);
    }
    Ok(PluginInstallResponse {
        auth_policy: entry.auth_policy,
        // No hosted connector authorization is established by copying a package.
        apps_needing_auth: components.apps,
    })
}

pub(crate) fn uninstall(
    store: &PluginStore,
    params: PluginUninstallParams,
) -> Result<PluginUninstallResponse, String> {
    let id = PluginId::parse(&params.plugin_id)?;
    let base = store.base_root(&id);
    // Keep the previous package available until the shared config is committed.
    let staging = if base.exists() {
        let staging = tempfile::Builder::new()
            .prefix(".plugin-remove-")
            .tempdir_in(base.parent().expect("plugin base parent"))
            .map_err(io_error("创建 Plugin uninstall staging 失败"))?;
        fs::rename(&base, staging.path().join("backup"))
            .map_err(io_error("暂存 Plugin cache 失败"))?;
        Some(staging)
    } else {
        None
    };
    if let Err(error) = store.clear_config(&id) {
        if let Some(staging) = staging {
            fs::rename(staging.path().join("backup"), &base).map_err(|rollback| {
                format!("Plugin config 清理失败: {error}; cache 回滚失败: {rollback}")
            })?;
        }
        return Err(error);
    }
    Ok(PluginUninstallResponse {})
}
