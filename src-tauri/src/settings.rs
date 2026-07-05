//! Persisted typography choices.
//!
//! The four font knobs the user picks survive a restart. The labels
//! are the keys of the curated font list in main.ts — backend stays
//! agnostic about what's bundleable and what's system-fallback, just
//! round-trips the string.

use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    #[serde(rename = "headingFont")]
    pub heading_font: String,
    #[serde(rename = "headingSize")]
    pub heading_size: u32,
    #[serde(rename = "bodyFont")]
    pub body_font: String,
    #[serde(rename = "bodySize")]
    pub body_size: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            heading_font: "Charter".into(),
            heading_size: 28,
            body_font: "Inter".into(),
            body_size: 16,
        }
    }
}

pub fn state_dir() -> PathBuf {
    std::env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("state")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("krill-markdown-reader")
}

fn settings_path() -> PathBuf {
    state_dir().join("settings.json")
}

pub fn load() -> Settings {
    let path = settings_path();
    let Ok(bytes) = std::fs::read(&path) else { return Settings::default() };
    serde_json::from_slice(&bytes).unwrap_or_else(|e| {
        eprintln!("[markdown-reader] settings.json malformed: {e:?}");
        Settings::default()
    })
}

pub fn save(s: &Settings) -> Result<()> {
    let dir = state_dir();
    std::fs::create_dir_all(&dir).with_context(|| format!("mkdir {}", dir.display()))?;
    let bytes = serde_json::to_vec_pretty(s)?;
    std::fs::write(settings_path(), bytes).context("writing settings.json")?;
    Ok(())
}
