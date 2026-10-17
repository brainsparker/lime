//! 共享配置文件的进程内读改写锁。

use std::sync::{Mutex, MutexGuard, OnceLock};

pub fn config_file_lock() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|error| error.into_inner())
}
