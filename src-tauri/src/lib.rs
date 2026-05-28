use std::path::PathBuf;

use krill_desktop_core::{fs as kfs, updater::BuilderExt};

#[tauri::command]
fn read_md(path: String) -> Result<String, String> {
    let bytes = kfs::read_bytes(std::path::Path::new(&path))?;
    String::from_utf8(bytes).map_err(|e| format!("not valid utf-8: {e}"))
}

#[tauri::command]
fn absolute_path(path: String) -> String {
    kfs::absolute_path(std::path::Path::new(&path))
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
    tauri::Builder::default()
        .with_updater()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_md,
            absolute_path,
            dev_test_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
