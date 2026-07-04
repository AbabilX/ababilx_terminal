//! Alias expansion on the parsed AST: the first word of each simple command
//! is replaced by the parsed alias value. Recursive aliases are cut with a
//! seen-set (`alias ls='ls -a'` works; `alias a=b; alias b=a` stops).

use std::collections::HashMap;
use std::collections::HashSet;

use ababil_parser::ast::{Program, Word, WordPart};

pub fn expand_aliases(program: &mut Program, aliases: &HashMap<String, String>) -> Result<(), String> {
    for seq in &mut program.sequences {
        for pipeline in std::iter::once(&mut seq.first).chain(seq.rest.iter_mut().map(|(_, p)| p)) {
            for cmd in &mut pipeline.commands {
                expand_command(&mut cmd.words, aliases)?;
            }
        }
    }
    Ok(())
}

fn expand_command(words: &mut Vec<Word>, aliases: &HashMap<String, String>) -> Result<(), String> {
    let mut seen: HashSet<String> = HashSet::new();
    loop {
        let Some(name) = literal_name(words.first()) else {
            return Ok(());
        };
        let Some(value) = aliases.get(&name) else {
            return Ok(());
        };
        if !seen.insert(name.clone()) {
            return Ok(()); // cycle: stop expanding
        }
        // Alias values are plain word lists in v1 — operators inside alias
        // values arrive with the full alias engine later.
        let replacement = ababil_parser::parse(value)
            .map_err(|e| format!("alias {name}: parse error: {e}"))?;
        let mut new_words: Vec<Word> = match single_command_words(&replacement) {
            Some(w) => w,
            None => return Err(format!("alias {name}: operators in alias values are not supported yet")),
        };
        new_words.extend(words.drain(1..));
        *words = new_words;
    }
}

/// Only expand when the command name is a plain literal (no variables).
fn literal_name(word: Option<&Word>) -> Option<String> {
    let word = word?;
    let mut name = String::new();
    for part in &word.parts {
        match part {
            WordPart::Bare(s) | WordPart::Quoted(s) => name.push_str(s),
            WordPart::Variable(_) => return None,
        }
    }
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn single_command_words(program: &Program) -> Option<Vec<Word>> {
    if program.sequences.len() != 1 {
        return None;
    }
    let seq = &program.sequences[0];
    if !seq.rest.is_empty() || seq.first.commands.len() != 1 {
        return None;
    }
    let cmd = &seq.first.commands[0];
    if !cmd.redirects.is_empty() {
        return None;
    }
    Some(cmd.words.clone())
}
