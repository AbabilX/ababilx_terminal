//! Local filesystem backend via `std::fs` — never shells out.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use crate::traits::{DirEntry, FileMeta, FileSystem};

#[derive(Debug, Default, Clone, Copy)]
pub struct RealFs;

impl FileSystem for RealFs {
    fn read(&self, path: &Path) -> io::Result<Vec<u8>> {
        fs::read(path)
    }

    fn write(&self, path: &Path, data: &[u8], append: bool) -> io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(append)
            .truncate(!append)
            .open(path)?;
        file.write_all(data)
    }

    fn read_dir(&self, path: &Path) -> io::Result<Vec<DirEntry>> {
        let mut entries = Vec::new();
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let meta = entry.metadata()?;
            entries.push(DirEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_dir: meta.is_dir(),
                len: meta.len(),
            });
        }
        entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(entries)
    }

    fn metadata(&self, path: &Path) -> io::Result<FileMeta> {
        let meta = fs::metadata(path)?;
        Ok(FileMeta {
            is_dir: meta.is_dir(),
            len: meta.len(),
        })
    }

    fn create_dir(&self, path: &Path) -> io::Result<()> {
        fs::create_dir_all(path)
    }

    fn remove(&self, path: &Path) -> io::Result<()> {
        if fs::metadata(path)?.is_dir() {
            fs::remove_dir_all(path)
        } else {
            fs::remove_file(path)
        }
    }

    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        fs::rename(from, to)
    }

    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
        let p = fs::canonicalize(path)?;
        // Strip Windows `\\?\` verbatim prefix for display-friendly paths.
        Ok(strip_verbatim(p))
    }

    fn exists(&self, path: &Path) -> bool {
        path.exists()
    }
}

fn strip_verbatim(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC") => PathBuf::from(rest),
        _ => p,
    }
}
