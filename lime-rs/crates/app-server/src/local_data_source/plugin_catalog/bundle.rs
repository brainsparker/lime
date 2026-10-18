use super::*;
use flate2::bufread::GzDecoder;
use std::collections::BTreeSet;
use std::io::{BufRead, BufReader, Write};

/// The caller owns the private directory through validation and cache commit.
pub(super) fn extract(file: &Path) -> Result<tempfile::TempDir, String> {
    extract_with_limit(file, MAX_PACKAGE_BYTES)
}

fn extract_with_limit(file: &Path, max_bytes: u64) -> Result<tempfile::TempDir, String> {
    let file = fs::File::open(file).map_err(io_error("读取 Plugin tar.gz 失败"))?;
    if file
        .metadata()
        .map_err(io_error("读取 Plugin tar.gz 大小失败"))?
        .len()
        > crate::plugin_remote::bundle::MAX_COMPRESSED_BYTES
    {
        return Err("Plugin tar.gz 超过压缩大小限制。".into());
    }
    let private = tempfile::Builder::new()
        .prefix("plugin-bundle-")
        .tempdir()
        .map_err(io_error("创建 Plugin 私有解包目录失败"))?;
    // Bound tar headers, long-name metadata and padding too; a file-only budget
    // cannot stop a gzip bomb made entirely of archive metadata or zero blocks.
    const MAX_TAR_OVERHEAD: u64 = 32 * 1024 * 1024;
    let decoded = GzDecoder::new(BufReader::new(file))
        .take(max_bytes.saturating_add(MAX_TAR_OVERHEAD).saturating_add(1));
    let mut archive = tar::Archive::new(decoded);
    let mut seen = BTreeSet::new();
    let mut total = 0u64;
    let mut count = 0usize;
    for entry in archive
        .entries()
        .map_err(io_error("读取 Plugin tar 失败"))?
    {
        let mut entry = entry.map_err(io_error("读取 Plugin tar entry 失败"))?;
        let path = entry
            .path()
            .map_err(io_error("读取 Plugin tar path 失败"))?;
        let path = checked_path(&path)?;
        let kind = entry.header().entry_type();
        if !kind.is_file() && !kind.is_dir() {
            return Err("Plugin tar 禁止链接和特殊类型。".into());
        }
        if let Some(extensions) = entry
            .pax_extensions()
            .map_err(io_error("读取 Plugin tar PAX 失败"))?
        {
            for extension in extensions {
                if extension
                    .map_err(io_error("读取 Plugin tar PAX 字段失败"))?
                    .key_bytes()
                    .starts_with(b"GNU.sparse.")
                {
                    return Err("Plugin tar 禁止稀疏文件。".into());
                }
            }
        }
        if kind.is_dir() && entry.size() != 0 {
            return Err("Plugin tar directory 包含文件内容。".into());
        }
        // A leading ./ directory is emitted by common tar packers.
        if path.as_os_str().is_empty() && kind.is_dir() {
            continue;
        }
        if path.as_os_str().is_empty() || !seen.insert(path.clone()) {
            return Err("Plugin tar 存在空路径或重复条目。".into());
        }
        count += 1;
        if count > MAX_PACKAGE_FILES {
            return Err("Plugin tar 超过条目数量限制。".into());
        }
        let output = private.path().join(path);
        if kind.is_dir() {
            fs::create_dir_all(output).map_err(io_error("创建 Plugin tar directory 失败"))?;
            continue;
        }
        total = total
            .checked_add(entry.size())
            .ok_or("Plugin tar 超过展开大小限制。")?;
        if total > max_bytes {
            return Err("Plugin tar 超过展开大小限制。".into());
        }
        fs::create_dir_all(output.parent().expect("private bundle parent"))
            .map_err(io_error("创建 Plugin tar parent 失败"))?;
        let mut destination = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output)
            .map_err(io_error("创建 Plugin tar file 失败"))?;
        let copied = std::io::copy(&mut entry, &mut destination)
            .map_err(io_error("展开 Plugin tar file 失败"))?;
        if copied != entry.size() {
            return Err("Plugin tar 文件被截断。".into());
        }
        destination
            .flush()
            .map_err(io_error("完成 Plugin tar file 失败"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = entry
                .header()
                .mode()
                .map_err(io_error("读取 Plugin tar mode 失败"))?;
            fs::set_permissions(&output, fs::Permissions::from_mode(mode & 0o777))
                .map_err(io_error("设置 Plugin tar mode 失败"))?;
        }
    }
    // tar stops at its zero blocks; drain the gzip trailer to verify its CRC and
    // reject concatenated gzip streams or nonzero data after the tar end marker.
    let mut decoder = archive.into_inner();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = decoder
            .read(&mut buffer)
            .map_err(io_error("校验 Plugin gzip 失败"))?;
        if read == 0 {
            break;
        }
        if buffer[..read].iter().any(|byte| *byte != 0) {
            return Err("Plugin tar 结束后存在额外内容。".into());
        }
    }
    if decoder.limit() == 0 {
        return Err("Plugin tar metadata 或 padding 超过大小限制。".into());
    }
    if !decoder
        .into_inner()
        .into_inner()
        .fill_buf()
        .map_err(io_error("校验 Plugin gzip 结束失败"))?
        .is_empty()
    {
        return Err("Plugin gzip 结束后存在额外压缩流或内容。".into());
    }
    Ok(private)
}

pub(super) fn checked_path(path: &Path) -> Result<PathBuf, String> {
    let text = path.to_str().ok_or("Plugin tar path 必须是 UTF-8。")?;
    if text.trim() != text
        || text.contains(['\\', ':', '\0'])
        || text.split('/').any(|part| part == "..")
        || path.components().any(|part| {
            matches!(
                part,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("Plugin tar path 越界或不跨平台。".into());
    }
    let path: PathBuf = path
        .components()
        .filter(|part| !matches!(part, Component::CurDir))
        .collect();
    if path.components().count() > 256 {
        return Err("Plugin tar path 超过 256 层限制。".into());
    }
    Ok(path)
}

#[cfg(test)]
mod tests;
