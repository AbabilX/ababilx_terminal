//! Word expansion: variables, tilde, globs. Runs at execution time against
//! the session's own environment (never the OS process environment).

use ababil_parser::ast::{Word, WordPart};

use crate::glob;
use crate::state::ShellState;
use crate::traits::FileSystem;

/// Expand one word into zero-or-more argv strings (globs may fan out).
pub fn expand_word(word: &Word, state: &ShellState, fs: &dyn FileSystem) -> Vec<String> {
    // 1. Resolve variables into (text, is_literal) segments.
    let mut segments: Vec<(String, bool)> = Vec::new();
    for part in &word.parts {
        match part {
            WordPart::Bare(s) => segments.push((s.clone(), false)),
            WordPart::Quoted(s) => segments.push((s.clone(), true)),
            WordPart::Variable(name) => {
                let value = match name.as_str() {
                    // `$?` style is not lexed; expose last status as `$STATUS`.
                    "STATUS" => state.last_status.to_string(),
                    "PWD" => state.cwd.to_string_lossy().into_owned(),
                    _ => state.get_env(name).unwrap_or("").to_string(),
                };
                // Variable results are literal: they never glob-expand.
                segments.push((value, true));
            }
        }
    }

    // 2. Tilde: only when the word starts with an unquoted `~`.
    if let Some((first, false)) = segments.first().map(|(s, l)| (s.clone(), *l)) {
        if first == "~" || first.starts_with("~/") || first.starts_with("~\\") {
            if let Some(home) = state.home_dir() {
                let rest = &first[1..];
                segments[0] = (format!("{}{}", home.to_string_lossy(), rest), true);
            }
        }
    }

    // 3. Glob only if an unquoted segment carries metacharacters.
    let has_glob = segments
        .iter()
        .any(|(s, literal)| !literal && s.contains(['*', '?']));
    if has_glob {
        let components = glob::compile(&segments);
        // Absolute patterns walk from the pattern root; relative from cwd.
        let joined: String = segments.iter().map(|(s, _)| s.as_str()).collect();
        let is_abs = std::path::Path::new(&joined).is_absolute();
        let matches = if is_abs {
            // v1: glob only relative to cwd; absolute patterns fall through
            // literally. Revisit with the PTY/exec phase.
            Vec::new()
        } else {
            glob::walk(fs, &state.cwd, &components)
        };
        if !matches.is_empty() {
            return matches;
        }
    }

    vec![segments.into_iter().map(|(s, _)| s).collect()]
}

/// Expand a full argv (all words of a command).
pub fn expand_words(words: &[Word], state: &ShellState, fs: &dyn FileSystem) -> Vec<String> {
    words
        .iter()
        .flat_map(|w| expand_word(w, state, fs))
        .collect()
}
