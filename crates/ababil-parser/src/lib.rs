//! AbabilX shell language front-end.
//!
//! Pipeline: source text -> [`lexer`] tokens -> [`parser`] -> [`ast::Program`].
//! This crate is pure: no filesystem, no environment, no process access.
//! Variable/tilde/glob expansion happens later in `ababil-runtime`, which is
//! why words are kept as [`ast::Word`] part lists instead of plain strings.

pub mod ast;
pub mod error;
pub mod lexer;
pub mod parser;
pub mod token;

pub use ast::Program;
pub use error::ParseError;

/// Parse a full input line (possibly containing `;`, `&&`, `||`, pipes and
/// redirects) into a [`Program`].
pub fn parse(input: &str) -> Result<Program, ParseError> {
    let tokens = lexer::lex(input)?;
    parser::parse_tokens(&tokens)
}
