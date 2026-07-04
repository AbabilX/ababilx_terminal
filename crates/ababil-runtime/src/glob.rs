//! Minimal glob engine: `*` and `?` (v1; character classes later). Quoted
//! text never matches as a pattern — patterns are built from typed segments
//! carrying their quoting, so `"*"` stays literal while `*` globs.

use std::path::{Path, PathBuf};

use crate::traits::FileSystem;

/// One pattern element after quoting is resolved.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Pat {
    Lit(char),
    /// `*` — any run of chars (not crossing path separators here; the walk
    /// splits on separators first).
    Any,
    /// `?` — exactly one char.
    One,
}

/// Compile a segment list into per-path-component patterns.
/// `segments`: (text, is_literal). Separators split components.
pub fn compile(segments: &[(String, bool)]) -> Vec<Vec<Pat>> {
    let mut components: Vec<Vec<Pat>> = vec![Vec::new()];
    for (text, literal) in segments {
        for c in text.chars() {
            if c == '/' || c == '\\' {
                components.push(Vec::new());
                continue;
            }
            let pat = if *literal {
                Pat::Lit(c)
            } else {
                match c {
                    '*' => Pat::Any,
                    '?' => Pat::One,
                    _ => Pat::Lit(c),
                }
            };
            components.last_mut().unwrap().push(pat);
        }
    }
    components
}

pub fn component_has_wildcard(pats: &[Pat]) -> bool {
    pats.iter().any(|p| matches!(p, Pat::Any | Pat::One))
}

pub fn component_literal(pats: &[Pat]) -> String {
    pats.iter()
        .map(|p| match p {
            Pat::Lit(c) => *c,
            Pat::Any => '*',
            Pat::One => '?',
        })
        .collect()
}

/// Classic backtracking wildcard match, case-insensitive on Windows.
pub fn matches(pats: &[Pat], name: &str) -> bool {
    let chars: Vec<char> = name.chars().collect();
    match_at(pats, &chars)
}

fn eq_c(a: char, b: char) -> bool {
    if cfg!(windows) {
        a.eq_ignore_ascii_case(&b) || a == b
    } else {
        a == b
    }
}

fn match_at(pats: &[Pat], chars: &[char]) -> bool {
    match pats.split_first() {
        None => chars.is_empty(),
        Some((Pat::Lit(c), rest)) => {
            matches!(chars.split_first(), Some((&first, tail)) if eq_c(*c, first) && match_at(rest, tail))
        }
        Some((Pat::One, rest)) => {
            matches!(chars.split_first(), Some((_, tail)) if match_at(rest, tail))
        }
        Some((Pat::Any, rest)) => (0..=chars.len()).any(|i| match_at(rest, &chars[i..])),
    }
}

/// Expand a compiled pattern relative to `base`. Returns matches sorted;
/// empty when nothing matched (caller falls back to the literal word).
pub fn walk(fs: &dyn FileSystem, base: &Path, components: &[Vec<Pat>]) -> Vec<String> {
    let mut results = Vec::new();
    walk_inner(fs, base, components, String::new(), &mut results);
    results.sort();
    results
}

fn walk_inner(
    fs: &dyn FileSystem,
    dir: &Path,
    components: &[Vec<Pat>],
    prefix: String,
    out: &mut Vec<String>,
) {
    let Some((comp, rest)) = components.split_first() else {
        return;
    };
    let join = |prefix: &str, name: &str| {
        if prefix.is_empty() {
            name.to_string()
        } else {
            format!("{prefix}/{name}")
        }
    };

    if !component_has_wildcard(comp) {
        // Literal component: descend without scanning the directory.
        let name = component_literal(comp);
        let next_dir: PathBuf = dir.join(&name);
        let path_str = join(&prefix, &name);
        if rest.is_empty() {
            if fs.exists(&next_dir) {
                out.push(path_str);
            }
        } else {
            walk_inner(fs, &next_dir, rest, path_str, out);
        }
        return;
    }

    let Ok(entries) = fs.read_dir(dir) else {
        return;
    };
    for entry in entries {
        // `*` must not match dotfiles unless the pattern starts with `.`.
        if entry.name.starts_with('.') && !matches!(comp.first(), Some(Pat::Lit('.'))) {
            continue;
        }
        if !matches(comp, &entry.name) {
            continue;
        }
        let path_str = join(&prefix, &entry.name);
        if rest.is_empty() {
            out.push(path_str);
        } else if entry.is_dir {
            walk_inner(fs, &dir.join(&entry.name), rest, path_str, out);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pats(s: &str) -> Vec<Pat> {
        compile(&[(s.to_string(), false)]).remove(0)
    }

    #[test]
    fn wildcard_match() {
        assert!(matches(&pats("*.rs"), "main.rs"));
        assert!(matches(&pats("m?in.rs"), "main.rs"));
        assert!(!matches(&pats("*.rs"), "main.ts"));
        assert!(matches(&pats("*"), "anything"));
        assert!(!matches(&pats("a*b"), "ac"));
    }

    #[test]
    fn quoted_star_is_literal() {
        let comps = compile(&[("*".to_string(), true)]);
        assert!(!component_has_wildcard(&comps[0]));
    }
}
