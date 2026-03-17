use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Local;
use log::{LevelFilter, Log, Metadata, Record, SetLoggerError};

use crate::auth::connection::queryverse_data_dir;

struct LoggerState {
    day: String,
    file: File,
}

pub struct DailyFileLogger {
    level: LevelFilter,
    logs_dir: PathBuf,
    state: Mutex<Option<LoggerState>>,
}

impl DailyFileLogger {
    fn new(level: LevelFilter, logs_dir: PathBuf) -> Self {
        Self {
            level,
            logs_dir,
            state: Mutex::new(None),
        }
    }

    fn open_daily_log_file(&self, day: &str) -> std::io::Result<LoggerState> {
        fs::create_dir_all(&self.logs_dir)?;
        let path = self.logs_dir.join(format!("{day}.log"));
        let file = OpenOptions::new().create(true).append(true).open(path)?;
        Ok(LoggerState {
            day: day.to_string(),
            file,
        })
    }
}

impl Log for DailyFileLogger {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        metadata.level() <= self.level
    }

    fn log(&self, record: &Record<'_>) {
        if !self.enabled(record.metadata()) {
            return;
        }

        let now = Local::now();
        let day = now.format("%Y-%m-%d").to_string();
        let timestamp = now.format("%Y-%m-%d %H:%M:%S%.3f");
        let line = format!(
            "{timestamp} [{}] [{}] {}\n",
            record.level(),
            record.target(),
            record.args()
        );

        let Ok(mut state) = self.state.lock() else {
            return;
        };

        let rotate = match state.as_ref() {
            Some(current) => current.day != day,
            None => true,
        };

        if rotate {
            match self.open_daily_log_file(&day) {
                Ok(new_state) => *state = Some(new_state),
                Err(_) => return,
            }
        }

        if let Some(current) = state.as_mut() {
            let _ = current.file.write_all(line.as_bytes());
        }
    }

    fn flush(&self) {
        if let Ok(mut state) = self.state.lock()
            && let Some(current) = state.as_mut()
        {
            let _ = current.file.flush();
        }
    }
}

pub fn init_logger(level: LevelFilter) -> Result<(), String> {
    let logs_dir = queryverse_data_dir()?.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;

    let logger = DailyFileLogger::new(level, logs_dir);
    let logger_ref: &'static DailyFileLogger = Box::leak(Box::new(logger));
    set_logger(logger_ref).map_err(|e| e.to_string())?;
    log::set_max_level(level);
    Ok(())
}

fn set_logger(logger: &'static DailyFileLogger) -> Result<(), SetLoggerError> {
    log::set_logger(logger)
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use log::{Level, Log};

    use super::*;

    #[test]
    fn writes_log_entry_to_daily_file() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time before epoch")
            .as_nanos();
        let log_dir = std::env::temp_dir().join(format!("queryverse-log-test-{unique}"));

        let logger = DailyFileLogger::new(LevelFilter::Info, log_dir.clone());
        let record = Record::builder()
            .args(format_args!("test message"))
            .level(Level::Info)
            .target("queryverse::tests")
            .build();

        Log::log(&logger, &record);
        logger.flush();

        let day = Local::now().format("%Y-%m-%d").to_string();
        let log_path = log_dir.join(format!("{day}.log"));
        let contents = fs::read_to_string(log_path).expect("expected log file");

        assert!(contents.contains("[INFO] [queryverse::tests] test message"));

        let _ = fs::remove_dir_all(log_dir);
    }
}
