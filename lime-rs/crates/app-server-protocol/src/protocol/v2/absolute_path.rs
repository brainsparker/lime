use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

/// A host path validated when entering the protocol boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(try_from = "PathBuf", into = "PathBuf")]
pub struct AbsolutePathBuf(PathBuf);

impl TryFrom<PathBuf> for AbsolutePathBuf {
    type Error = String;

    fn try_from(path: PathBuf) -> Result<Self, Self::Error> {
        if !path.is_absolute() {
            return Err("expected an absolute path".into());
        }
        let mut normalized = PathBuf::new();
        for part in path.components() {
            match part {
                Component::CurDir => {}
                Component::ParentDir => {
                    normalized.pop();
                }
                _ => normalized.push(part.as_os_str()),
            }
        }
        Ok(Self(normalized))
    }
}

impl From<AbsolutePathBuf> for PathBuf {
    fn from(path: AbsolutePathBuf) -> Self {
        path.0
    }
}

impl AsRef<Path> for AbsolutePathBuf {
    fn as_ref(&self) -> &Path {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protocol_absolute_path_rejects_relative_values() {
        for value in ["", ".", "plugins/example", "../example"] {
            assert!(serde_json::from_value::<AbsolutePathBuf>(serde_json::json!(value)).is_err());
        }
        let path = std::env::current_dir().unwrap().join("plugin");
        let validated: AbsolutePathBuf = serde_json::from_value(serde_json::json!(path)).unwrap();
        assert_eq!(validated.as_ref(), path);
        assert_eq!(
            serde_json::to_value(validated).unwrap(),
            serde_json::json!(path)
        );
        let dotted = path.join("child/.././leaf");
        assert_eq!(
            AbsolutePathBuf::try_from(dotted).unwrap().as_ref(),
            path.join("leaf")
        );
    }
}
