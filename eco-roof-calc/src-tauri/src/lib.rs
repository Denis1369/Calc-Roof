#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn sanitize_file_name(file_name: &str) -> String {
    let cleaned: String = file_name
        .chars()
        .map(|ch| match ch {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => ch,
        })
        .collect();

    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "export.xlsx".to_string()
    } else {
        trimmed.to_string()
    }
}

fn downloads_dir() -> Result<std::path::PathBuf, String> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(std::path::PathBuf::from)
        .ok_or_else(|| "Не удалось определить домашнюю папку пользователя".to_string())?;

    let downloads = home.join("Downloads");
    if downloads.is_dir() {
        return Ok(downloads);
    }

    let desktop = home.join("Desktop");
    if desktop.is_dir() {
        return Ok(desktop);
    }

    Ok(home)
}

fn unique_export_path(file_name: &str) -> Result<std::path::PathBuf, String> {
    let dir = downloads_dir()?;
    let safe_name = sanitize_file_name(file_name);
    let original = std::path::PathBuf::from(&safe_name);
    let stem = original
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("export");
    let extension = original
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("xlsx");

    let mut candidate = dir.join(&safe_name);
    let mut counter = 1;

    while candidate.exists() {
        candidate = dir.join(format!("{} ({counter}).{}", stem, extension));
        counter += 1;
    }

    Ok(candidate)
}

#[tauri::command]
fn save_file_to_downloads(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let path = unique_export_path(&file_name)?;
    std::fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build()) 
        .invoke_handler(tauri::generate_handler![greet, save_file_to_downloads])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
