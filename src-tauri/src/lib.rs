mod watch;

use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, State};
use tokio::sync::Mutex;

use krill_desktop_core::{fs as kfs, updater::BuilderExt};

#[derive(Default)]
struct AppCtx {
    /// Active file watcher, if any. Dropping it stops the watch.
    /// Held in an Option so opening a new file can swap atomically:
    /// drop the old watcher, install the new one.
    watch: Mutex<Option<watch::Watch>>,
}

#[tauri::command]
fn read_md(path: String) -> Result<String, String> {
    let bytes = kfs::read_bytes(std::path::Path::new(&path))?;
    String::from_utf8(bytes).map_err(|e| format!("not valid utf-8: {e}"))
}

#[tauri::command]
fn absolute_path(path: String) -> String {
    kfs::absolute_path(std::path::Path::new(&path))
}

#[tauri::command]
async fn watch_file(
    path: String,
    app: AppHandle,
    state: State<'_, Arc<AppCtx>>,
) -> Result<(), String> {
    // Drop any previous watcher *before* starting the new one so we
    // never have two notifying about old + new paths simultaneously.
    let mut g = state.watch.lock().await;
    *g = None;
    let w = watch::start(std::path::Path::new(&path), app)
        .map_err(|e| format!("{e:#}"))?;
    *g = Some(w);
    Ok(())
}

#[tauri::command]
async fn stop_watching(state: State<'_, Arc<AppCtx>>) -> Result<(), String> {
    *state.watch.lock().await = None;
    Ok(())
}

/// Dev convenience: returns the path to a test fixture if present so
/// `pnpm tauri dev` opens something on launch without a CLI arg.
#[tauri::command]
fn dev_test_file() -> Option<String> {
    let candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("test.md"));
    match candidate {
        Some(p) if p.exists() => Some(p.display().to_string()),
        _ => None,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ctx = Arc::new(AppCtx::default());
    tauri::Builder::default()
        .manage(ctx)
        .with_updater()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_md,
            absolute_path,
            watch_file,
            stop_watching,
            dev_test_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
