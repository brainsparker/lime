use super::*;
use crate::plugin_remote::wire::Release;

// Only call on the private, link-free extracted tree before the store transaction.
pub(super) fn prepare(
    root: &Path,
    scope: Scope,
    name: &str,
    version: &str,
    release: &Release,
) -> Result<(), String> {
    if scope != Scope::Global {
        return Ok(());
    }
    let path = manifest::find_manifest_path(root)?;
    let contents = manifest::read_manifest_file(&path)?;
    let mut value: Value = serde_json::from_str(&contents)
        .map_err(|error| format!("解析远端 Plugin manifest 失败: {error}"))?;
    if path != root.join("plugin.json") || !manifest::is_standard_manifest(&value) {
        value
            .as_object_mut()
            .ok_or("远端 Plugin manifest 必须是 object。")?
            .insert("version".into(), Value::String(version.to_string()));
        write_json(&path, &value)?;
    }
    if let Some(app_manifest) = &release.app_manifest {
        let manifest = manifest::read_manifest_with_name(root, Some(name))?;
        let path = apps::manifest_path(root, manifest.get("apps"));
        write_json(&path, app_manifest)?;
    }
    Ok(())
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let parent = path.parent().ok_or("远端 Plugin 元数据缺少父目录。")?;
    fs::create_dir_all(parent).map_err(io_error("创建远端 Plugin 元数据目录失败"))?;
    let mut contents = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("序列化远端 Plugin 元数据失败: {error}"))?;
    contents.push(b'\n');
    fs::write(path, contents).map_err(io_error("写入远端 Plugin 元数据失败"))
}
