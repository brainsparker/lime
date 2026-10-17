use super::*;

pub(super) fn package_digest(package_root: &Path) -> Result<String, String> {
    let package_root = canonical_package_root(package_root)?;
    let mut files = Vec::new();
    collect_package_files(&package_root, &package_root, &mut files)?;
    files.sort_by(|left, right| left.0.cmp(&right.0));
    let mut hasher = Sha256::new();
    for (relative, path) in files {
        hasher.update((relative.len() as u64).to_be_bytes());
        hasher.update(relative.as_bytes());
        let mut file = fs::File::open(path).map_err(io_error("读取 Plugin digest 文件失败"))?;
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let read = file
                .read(&mut buffer)
                .map_err(io_error("计算 Plugin package digest 失败"))?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
    }
    Ok(format!("sha256:{}", hex::encode(hasher.finalize())))
}

pub(super) fn collect_package_files(
    package_root: &Path,
    current: &Path,
    files: &mut Vec<(String, PathBuf)>,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(io_error("读取 Plugin package 目录失败"))? {
        let entry = entry.map_err(io_error("读取 Plugin package 条目失败"))?;
        let path = entry.path();
        let metadata =
            fs::symlink_metadata(&path).map_err(io_error("读取 Plugin package 元数据失败"))?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "Plugin package 禁止包含符号链接: {}",
                path.display()
            ));
        }
        if metadata.is_dir() {
            collect_package_files(package_root, &path, files)?;
        } else if metadata.is_file() {
            let relative = path
                .strip_prefix(package_root)
                .map_err(|error| format!("计算 Plugin package 相对路径失败: {error}"))?
                .components()
                .map(|component| component.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/");
            files.push((relative, path));
        }
    }
    Ok(())
}

pub(super) fn validate_standard_name(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '.')
        || !id.as_bytes().first().is_some_and(u8::is_ascii_alphanumeric)
        || !id.as_bytes().last().is_some_and(u8::is_ascii_lowercase)
            && !id.as_bytes().last().is_some_and(u8::is_ascii_digit)
        || id.contains("--")
        || id.contains("..")
    {
        return Err(format!(
            "Plugin name 不符合 Agent Plugins identity 规则: {id}"
        ));
    }
    Ok(())
}

pub(super) fn canonical_package_root(path: &Path) -> Result<PathBuf, String> {
    let root = fs::canonicalize(path).map_err(io_error("解析 Plugin package root 失败"))?;
    if !root.is_dir() {
        return Err(format!("Plugin package root 不是目录: {}", root.display()));
    }
    Ok(root)
}

pub(super) fn resource_path(package_root: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative_path = Path::new(relative);
    if relative_path.is_absolute()
        || relative_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(format!("Plugin resource path 越界: {relative}"));
    }
    let package_root =
        fs::canonicalize(package_root).map_err(io_error("解析 Plugin package root 失败"))?;
    let resolved = fs::canonicalize(package_root.join(relative_path))
        .map_err(io_error("解析 Plugin resource 失败"))?;
    if !resolved.starts_with(&package_root) {
        return Err(format!("Plugin resource path 越界: {relative}"));
    }
    Ok(resolved)
}

pub(super) fn copy_package_tree(source_root: &Path, destination_root: &Path) -> Result<(), String> {
    let mut files = 0usize;
    let mut bytes = 0u64;
    copy_package_entry(source_root, destination_root, &mut files, &mut bytes)
}

pub(super) fn copy_package_entry(
    source: &Path,
    destination: &Path,
    files: &mut usize,
    bytes: &mut u64,
) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(source).map_err(io_error("读取 Plugin package 条目失败"))?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Plugin package 禁止包含符号链接: {}",
            source.display()
        ));
    }
    if metadata.is_dir() {
        fs::create_dir_all(destination).map_err(io_error("创建 Plugin package 条目失败"))?;
        for entry in fs::read_dir(source).map_err(io_error("读取 Plugin package 目录失败"))? {
            let entry = entry.map_err(io_error("读取 Plugin package 条目失败"))?;
            let entry_path = entry.path();
            let destination_path = destination.join(entry.file_name());
            copy_package_entry(&entry_path, &destination_path, files, bytes)?;
        }
    } else if metadata.is_file() {
        *files += 1;
        *bytes = bytes.saturating_add(metadata.len());
        if *files > MAX_PACKAGE_FILES || *bytes > MAX_PACKAGE_BYTES {
            return Err("Plugin package 超过文件数量或总大小限制。".to_string());
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(io_error("创建 Plugin package 文件目录失败"))?;
        }
        fs::copy(source, destination).map_err(io_error("复制 Plugin package 文件失败"))?;
    }
    Ok(())
}

pub(super) fn validate_plugin_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.starts_with('.')
        || id.ends_with('.')
        || id.contains("..")
        || !id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(format!("Plugin name 不能作为安全的 cache 路径: {id}"));
    }
    Ok(())
}
