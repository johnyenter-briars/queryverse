use crate::LaunchContext;

#[tauri::command]
pub async fn get_launch_context(
    _window: tauri::Window,
    context: tauri::State<'_, LaunchContext>,
) -> Result<LaunchContext, String> {
    Ok(LaunchContext {
        sql_file_path: context.sql_file_path.clone(),
        connection_name: context.connection_name.clone(),
    })
}
