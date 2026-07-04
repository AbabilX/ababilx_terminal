//! Abstract syntax tree for the AbabilX shell language.

/// One parsed input: sequences separated by `;`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Program {
    pub sequences: Vec<AndOrList>,
}

/// Pipelines chained with `&&` / `||`.
/// `a && b || c` => first: a, rest: [(And, b), (Or, c)]. Left-associative.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AndOrList {
    pub first: Pipeline,
    pub rest: Vec<(Connector, Pipeline)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Connector {
    /// `&&` — run next only if previous succeeded.
    And,
    /// `||` — run next only if previous failed.
    Or,
}

/// Commands connected by `|`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pipeline {
    pub commands: Vec<SimpleCommand>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SimpleCommand {
    /// argv words, unexpanded. `words[0]` is the command name.
    pub words: Vec<Word>,
    pub redirects: Vec<Redirect>,
}

/// A word is a concatenation of parts: `foo"$BAR"baz` is three parts.
/// Expansion (variables, tilde, globs) is the runtime's job; quoting metadata
/// is preserved here so the runtime knows what may glob-expand.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Word {
    pub parts: Vec<WordPart>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WordPart {
    /// Literal text typed unquoted. Subject to glob and tilde expansion.
    Bare(String),
    /// Literal text from quotes or escapes. Never glob-expanded.
    Quoted(String),
    /// `$NAME` or `${NAME}` (also valid inside double quotes).
    Variable(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Redirect {
    pub kind: RedirectKind,
    pub target: Word,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedirectKind {
    /// `< file`
    In,
    /// `> file`
    Out,
    /// `>> file`
    Append,
}

impl Word {
    /// Best-effort literal view, used for command names and error messages.
    pub fn to_display(&self) -> String {
        self.parts
            .iter()
            .map(|p| match p {
                WordPart::Bare(s) | WordPart::Quoted(s) => s.clone(),
                WordPart::Variable(name) => format!("${name}"),
            })
            .collect()
    }

    /// True if any part is an unquoted segment containing glob metacharacters.
    pub fn may_glob(&self) -> bool {
        self.parts.iter().any(|p| match p {
            WordPart::Bare(s) => s.contains(['*', '?', '[']),
            _ => false,
        })
    }
}
