use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ParseError {
    #[error("unterminated single quote")]
    UnterminatedSingleQuote,
    #[error("unterminated double quote")]
    UnterminatedDoubleQuote,
    #[error("unterminated variable expansion `${{`")]
    UnterminatedBrace,
    #[error("trailing backslash")]
    TrailingBackslash,
    #[error("unexpected token `{0}`")]
    UnexpectedToken(String),
    #[error("unexpected end of input after `{0}`")]
    UnexpectedEof(String),
    #[error("missing redirect target after `{0}`")]
    MissingRedirectTarget(String),
}
