use super::*;
use std::time::Duration;

/// Coordinate authenticated remote mutations across App Server processes.
/// The ordinary store lock is acquired later and owns staging/cache/config changes.
pub(in crate::local_data_source::plugin_catalog) async fn acquire(
    store: &PluginStore,
) -> Result<fs::File, String> {
    let root = store.root.clone();
    let file = tokio::task::spawn_blocking(move || {
        fs::create_dir_all(&root).map_err(io_error("创建 Plugin remote gate 失败"))?;
        fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(root.join(".remote-mutation.lock"))
            .map_err(io_error("打开 Plugin remote gate 失败"))
    })
    .await
    .map_err(|_| "remote plugin gate task failed".to_string())??;
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            match fs2::FileExt::try_lock_exclusive(&file) {
                Ok(()) => return Ok(()),
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        || error.raw_os_error() == fs2::lock_contended_error().raw_os_error() =>
                {
                    tokio::time::sleep(Duration::from_millis(25)).await;
                }
                Err(error) => return Err(format!("remote plugin gate unavailable: {error}")),
            }
        }
    })
    .await
    .map_err(|_| "timed out waiting for another remote plugin mutation".to_string())??;
    Ok(file)
}
