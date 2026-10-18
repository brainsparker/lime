use app_server_protocol::protocol::v2::Account;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;

const MAX_CREDENTIAL_BYTES: u64 = 256 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Credential {
    pub(super) account: Account,
    pub(super) access_token: String,
}

pub(super) fn load(path: &Path) -> Result<Option<Credential>, String> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("failed to open account credential".to_string()),
    };
    let mut bytes = Vec::new();
    file.take(MAX_CREDENTIAL_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "failed to read account credential")?;
    if bytes.len() as u64 > MAX_CREDENTIAL_BYTES {
        return Err("account credential exceeds size limit".to_string());
    }
    let credential: Credential = serde_json::from_slice(&bytes)
        .map_err(|_| "stored account credential is invalid".to_string())?;
    if credential.access_token.trim().is_empty() {
        return Err("stored account credential is invalid".to_string());
    }
    Ok(Some(credential))
}

pub(super) fn save(path: &Path, credential: &Credential) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("account credential parent is missing")?;
    let mut builder = fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder
        .create(parent)
        .map_err(|_| "failed to create account credential directory")?;
    let mut pending = tempfile::NamedTempFile::new_in(parent)
        .map_err(|_| "failed to create account credential file")?;
    let bytes =
        serde_json::to_vec(credential).map_err(|_| "failed to encode account credential")?;
    if bytes.len() as u64 > MAX_CREDENTIAL_BYTES {
        return Err("account credential exceeds size limit".to_string());
    }
    pending
        .write_all(&bytes)
        .and_then(|_| pending.as_file().sync_all())
        .map_err(|_| "failed to write account credential")?;
    pending
        .persist(path)
        .map_err(|_| "failed to replace account credential")?;
    Ok(())
}

pub(super) fn delete(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("failed to delete account credential".to_string()),
    }
}
