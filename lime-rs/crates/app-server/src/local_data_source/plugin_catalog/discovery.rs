use super::*;

pub(super) struct Marketplace {
    pub name: String,
    pub path: PathBuf,
    pub interface: Option<MarketplaceInterface>,
    pub plugins: Vec<MarketplacePlugin>,
}

pub(super) struct MarketplacePlugin {
    pub id: PluginId,
    pub root: PathBuf,
    pub install_policy: PluginInstallPolicy,
    pub auth_policy: PluginAuthPolicy,
}

pub(super) fn load_marketplace(path: &Path) -> Result<Marketplace, String> {
    if !path.is_absolute() {
        return Err("Plugin marketplacePath 必须是绝对路径。".to_string());
    }
    let path = fs::canonicalize(path).map_err(io_error("解析 marketplace 路径失败"))?;
    if !path.is_file() {
        return Err("Plugin marketplacePath 必须指向 marketplace 文件。".to_string());
    }
    let content = fs::read_to_string(&path).map_err(io_error("读取 marketplace 文件失败"))?;
    let value: Value = serde_json::from_str(&content)
        .map_err(|error| format!("解析 marketplace 文件失败: {error}"))?;
    let name = value
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "Plugin marketplace 缺少 name。".to_string())?
        .to_string();
    PluginId::new("marketplace", &name)?;
    let source_root = fs::canonicalize(marketplace_source_root(&path)?)
        .map_err(io_error("解析 marketplace root 失败"))?;
    let entries = value
        .get("plugins")
        .and_then(Value::as_array)
        .ok_or_else(|| "Plugin marketplace 缺少 plugins array。".to_string())?;
    let mut plugins = Vec::new();
    let mut names = std::collections::BTreeSet::new();
    for entry in entries {
        let plugin_name = entry
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| "Plugin marketplace entry 缺少 name。".to_string())?;
        let id = PluginId::new(plugin_name, &name)?;
        if !names.insert(plugin_name.to_string()) {
            return Err(format!("Plugin marketplace 存在重复名称: {plugin_name}"));
        }
        let source = entry
            .get("source")
            .ok_or_else(|| "Plugin marketplace entry 缺少 source。".to_string())?;
        let relative = source
            .as_str()
            .or_else(|| {
                (source.get("source").and_then(Value::as_str) == Some("local"))
                    .then(|| source.get("path").and_then(Value::as_str))
                    .flatten()
            })
            .ok_or_else(|| {
                format!("Plugin {plugin_name} 的 source 尚未支持本地 materialization。")
            })?;
        if relative != "."
            && (!relative.starts_with("./")
                || relative
                    .split(['/', '\\'])
                    .any(|part| matches!(part, ".." | "")))
        {
            return Err(format!(
                "Plugin marketplace local source 不合法: {relative}"
            ));
        }
        let root = canonical_package_root(&source_root.join(relative))?;
        if !root.starts_with(&source_root) {
            return Err(format!("Plugin marketplace local source 越界: {relative}"));
        }
        let manifest = manifest::read_manifest_with_name(&root, Some(plugin_name))?;
        if manifest_name(&manifest)? != plugin_name {
            return Err(format!(
                "Plugin marketplace name 与 manifest 不一致: {plugin_name}"
            ));
        }
        let install_policy = match entry.pointer("/policy/installation") {
            Some(value) => serde_json::from_value(value.clone())
                .map_err(|error| format!("Plugin installation policy 不合法: {error}"))?,
            None => PluginInstallPolicy::Available,
        };
        let auth_policy = match entry.pointer("/policy/authentication") {
            Some(value) => serde_json::from_value(value.clone())
                .map_err(|error| format!("Plugin authentication policy 不合法: {error}"))?,
            None => PluginAuthPolicy::OnUse,
        };
        plugins.push(MarketplacePlugin {
            id,
            root,
            install_policy,
            auth_policy,
        });
    }
    let interface = value
        .get("interface")
        .map(|value| serde_json::from_value(value.clone()))
        .transpose()
        .map_err(|error| format!("Marketplace interface 不合法: {error}"))?;
    Ok(Marketplace {
        name,
        path,
        interface,
        plugins,
    })
}

pub(super) fn resolve_plugin(
    marketplace_path: Option<&Path>,
    remote_marketplace_name: Option<&str>,
    plugin_name: &str,
) -> Result<(Marketplace, usize), String> {
    validate_plugin_id(plugin_name)?;
    if marketplace_path.is_some() == remote_marketplace_name.is_some() {
        return Err(
            "Plugin 请求必须且只能提供 marketplacePath 或 remoteMarketplaceName。".to_string(),
        );
    }
    if remote_marketplace_name.is_some() {
        return Err("远端 Plugin marketplace 尚未配置；不得回退本地包。".to_string());
    }
    let marketplace = load_marketplace(marketplace_path.ok_or_else(|| {
        "Plugin 请求必须提供 marketplacePath 或 remoteMarketplaceName。".to_string()
    })?)?;
    let index = marketplace
        .plugins
        .iter()
        .position(|entry| entry.id.name == plugin_name)
        .ok_or_else(|| {
            format!(
                "Plugin marketplace {} 中未找到 {plugin_name}",
                marketplace.name
            )
        })?;
    Ok((marketplace, index))
}

pub(super) fn marketplace_source_root(path: &Path) -> Result<PathBuf, String> {
    for relative_path in [
        ".agents/plugins/marketplace.json",
        ".agents/plugins/api_marketplace.json",
        ".claude-plugin/marketplace.json",
        ".cursor-plugin/marketplace.json",
    ] {
        let relative_path = Path::new(relative_path);
        if path.ends_with(relative_path) {
            let mut root = path.to_path_buf();
            for _ in relative_path.components() {
                root.pop();
            }
            return Ok(root);
        }
    }
    path.parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Plugin marketplace 文件缺少父目录。".to_string())
}

pub(super) fn implicit_marketplace_paths(
    store: &PluginStore,
    cwds: Option<&[PathBuf]>,
) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();
    if let Some(path) = &store.bundled_marketplace {
        paths.push(path.clone());
    }
    if let Some(home) = &store.home {
        paths.extend(marketplace_paths_for_root(home));
    }
    for cwd in cwds.unwrap_or_default() {
        if !cwd.is_absolute() {
            return Err("Plugin cwds 必须是绝对路径。".to_string());
        }
        paths.extend(marketplace_paths_for_root(cwd));
    }
    paths.retain(|path| path.is_file());
    paths.extend(super::marketplace::configured_paths(store)?);
    paths.sort();
    paths.dedup();
    Ok(paths)
}

pub(super) fn marketplace_paths_for_root(root: &Path) -> impl Iterator<Item = PathBuf> + '_ {
    [
        ".agents/plugins/marketplace.json",
        ".agents/plugins/api_marketplace.json",
        ".claude-plugin/marketplace.json",
        ".cursor-plugin/marketplace.json",
    ]
    .into_iter()
    .map(|relative| root.join(relative))
}

pub(super) fn bundled_marketplace_path_from_env() -> Option<PathBuf> {
    std::env::var_os("LIME_BUNDLED_PLUGIN_MARKETPLACE")
        .map(PathBuf::from)
        .filter(|path| path.is_file())
}
