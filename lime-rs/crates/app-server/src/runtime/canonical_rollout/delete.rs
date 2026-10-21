use std::fs;
use std::path::Path;

use super::RolloutStore;

impl RolloutStore {
    pub(in crate::runtime) fn delete(
        &self,
        relative_path: &Path,
        session_id: &str,
        thread_id: &str,
        archived: bool,
    ) -> Result<bool, String> {
        let path = if archived {
            self.resolve_archived(relative_path)?
        } else {
            self.resolve_active(relative_path)?
        };
        if super::compression::existing_path(&path)?.is_none() {
            return Ok(false);
        }
        self.verify_location(relative_path, session_id, thread_id, archived)?;
        // Remove the hidden representation first so a failed deletion cannot revive it.
        super::compression::remove_compressed(&path)?;
        match fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "failed to delete rollout {}: {error}",
                    path.display()
                ))
            }
        }
        Ok(true)
    }
}
