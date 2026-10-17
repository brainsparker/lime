//! 配置文件写入统一使用同目录临时文件，提交前不截断当前配置。

use std::fs;
use std::io::{self, Write};
use std::path::Path;

pub(super) fn write_config(path: &Path, content: &[u8]) -> io::Result<()> {
    // 保留通过符号链接配置文件的行为，替换其目标文件。
    let resolved = match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Some(fs::canonicalize(path)?),
        Ok(_) => None,
        Err(error) if error.kind() == io::ErrorKind::NotFound => None,
        Err(error) => return Err(error),
    };
    let path = resolved.as_deref().unwrap_or(path);
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    let mut staging = tempfile::NamedTempFile::new_in(parent)?;
    if let Ok(metadata) = fs::metadata(path) {
        staging.as_file().set_permissions(metadata.permissions())?;
    }
    staging.write_all(content)?;
    staging.as_file().sync_all()?;
    staging.persist(path).map_err(|error| error.error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_existing_config_and_keeps_unrelated_files() {
        let temp = tempfile::tempdir().unwrap();
        let config = temp.path().join("config.yaml");
        let other = temp.path().join("other.yaml");
        fs::write(&config, "plugins: {}\n").unwrap();
        fs::write(&other, "untouched").unwrap();
        write_config(
            &config,
            b"plugins:\n  example@market:\n    enabled: false\n",
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(config).unwrap(),
            "plugins:\n  example@market:\n    enabled: false\n"
        );
        assert_eq!(fs::read_to_string(other).unwrap(), "untouched");
        assert_eq!(fs::read_dir(temp.path()).unwrap().count(), 2);
    }

    #[test]
    fn failed_commit_preserves_target_and_removes_staging_file() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("config.yaml");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("keep"), "original").unwrap();
        assert!(write_config(&target, b"replacement").is_err());
        assert_eq!(fs::read_to_string(target.join("keep")).unwrap(), "original");
        assert_eq!(fs::read_dir(temp.path()).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn preserves_symlink_and_private_permissions() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("target.yaml");
        let link = temp.path().join("config.yaml");
        fs::write(&target, "original").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o600)).unwrap();
        symlink(&target, &link).unwrap();
        write_config(&link, b"updated").unwrap();
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "updated");
        assert_eq!(
            fs::metadata(&target).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
}
