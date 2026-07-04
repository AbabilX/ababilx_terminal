use thiserror::Error;

/// Hard runtime failures. Ordinary command failures (non-zero exit,
/// command-not-found) are reported as exit status + stderr text, not errors.
#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to launch `{program}`: {message}")]
    Launch { program: String, message: String },
}
