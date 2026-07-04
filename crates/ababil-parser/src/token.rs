use crate::ast::Word;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Token {
    Word(Word),
    /// `|`
    Pipe,
    /// `&&`
    And,
    /// `||`
    Or,
    /// `;`
    Semi,
    /// `<`
    RedirIn,
    /// `>`
    RedirOut,
    /// `>>`
    RedirAppend,
}

impl Token {
    pub fn display(&self) -> &'static str {
        match self {
            Token::Word(_) => "word",
            Token::Pipe => "|",
            Token::And => "&&",
            Token::Or => "||",
            Token::Semi => ";",
            Token::RedirIn => "<",
            Token::RedirOut => ">",
            Token::RedirAppend => ">>",
        }
    }
}
