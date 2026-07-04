//! Hand-written lexer. Produces operator tokens and words made of
//! quoting-aware parts; no expansion happens here.

use crate::ast::{Word, WordPart};
use crate::error::ParseError;
use crate::token::Token;

pub fn lex(input: &str) -> Result<Vec<Token>, ParseError> {
    Lexer::new(input).run()
}

struct Lexer<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
    tokens: Vec<Token>,
    /// Parts of the word currently being built.
    parts: Vec<WordPart>,
    /// Pending literal text not yet turned into a part.
    pending: String,
    /// Whether `pending` is quoted/escaped text (true) or bare text (false).
    pending_quoted: bool,
    /// True once the current word has any content, even empty quotes (`""`).
    word_started: bool,
}

impl<'a> Lexer<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            chars: input.chars().peekable(),
            tokens: Vec::new(),
            parts: Vec::new(),
            pending: String::new(),
            pending_quoted: false,
            word_started: false,
        }
    }

    fn push_text(&mut self, c: char, quoted: bool) {
        if self.pending_quoted != quoted && !self.pending.is_empty() {
            self.flush_pending_text();
        }
        self.pending_quoted = quoted;
        self.pending.push(c);
        self.word_started = true;
    }

    fn push_str(&mut self, s: &str, quoted: bool) {
        if self.pending_quoted != quoted && !self.pending.is_empty() {
            self.flush_pending_text();
        }
        self.pending_quoted = quoted;
        self.pending.push_str(s);
        self.word_started = true;
    }

    fn run(mut self) -> Result<Vec<Token>, ParseError> {
        while let Some(c) = self.chars.next() {
            match c {
                ' ' | '\t' | '\r' | '\n' => self.flush_word(),
                '\'' => self.single_quote()?,
                '"' => self.double_quote()?,
                '\\' => {
                    let next = self.chars.next().ok_or(ParseError::TrailingBackslash)?;
                    self.push_text(next, true);
                }
                '$' => self.variable(false),
                '|' => {
                    self.flush_word();
                    if self.chars.peek() == Some(&'|') {
                        self.chars.next();
                        self.tokens.push(Token::Or);
                    } else {
                        self.tokens.push(Token::Pipe);
                    }
                }
                '&' => {
                    self.flush_word();
                    if self.chars.peek() == Some(&'&') {
                        self.chars.next();
                        self.tokens.push(Token::And);
                    } else {
                        // Background jobs (`&`) are not supported yet.
                        return Err(ParseError::UnexpectedToken("&".into()));
                    }
                }
                ';' => {
                    self.flush_word();
                    self.tokens.push(Token::Semi);
                }
                '>' => {
                    self.flush_word();
                    if self.chars.peek() == Some(&'>') {
                        self.chars.next();
                        self.tokens.push(Token::RedirAppend);
                    } else {
                        self.tokens.push(Token::RedirOut);
                    }
                }
                '<' => {
                    self.flush_word();
                    self.tokens.push(Token::RedirIn);
                }
                _ => self.push_text(c, false),
            }
        }
        self.flush_word();
        Ok(self.tokens)
    }

    fn single_quote(&mut self) -> Result<(), ParseError> {
        self.word_started = true;
        loop {
            match self.chars.next() {
                Some('\'') => return Ok(()),
                Some(c) => self.push_text(c, true),
                None => return Err(ParseError::UnterminatedSingleQuote),
            }
        }
    }

    fn double_quote(&mut self) -> Result<(), ParseError> {
        self.word_started = true;
        loop {
            match self.chars.next() {
                Some('"') => return Ok(()),
                Some('\\') => match self.chars.next() {
                    // Inside double quotes, backslash only escapes these.
                    Some(c @ ('"' | '\\' | '$')) => self.push_text(c, true),
                    Some(c) => {
                        self.push_text('\\', true);
                        self.push_text(c, true);
                    }
                    None => return Err(ParseError::UnterminatedDoubleQuote),
                },
                Some('$') => self.variable(true),
                Some(c) => self.push_text(c, true),
                None => return Err(ParseError::UnterminatedDoubleQuote),
            }
        }
    }

    /// Parse `$NAME` / `${NAME}`. A `$` not followed by a valid name is
    /// literal. `in_quotes` decides the quoting of any literal fallback text.
    fn variable(&mut self, in_quotes: bool) {
        let braced = self.chars.peek() == Some(&'{');
        if braced {
            self.chars.next();
        }
        let mut name = String::new();
        while let Some(&c) = self.chars.peek() {
            if c.is_ascii_alphanumeric() || c == '_' {
                name.push(c);
                self.chars.next();
            } else {
                break;
            }
        }
        if braced {
            if self.chars.peek() == Some(&'}') && !name.is_empty() {
                self.chars.next();
            } else {
                // `${` without a closing brace: keep as literal text.
                let lit = format!("${{{name}}}");
                self.push_str(&lit, in_quotes);
                return;
            }
        }
        if name.is_empty() {
            self.push_text('$', in_quotes);
            return;
        }
        self.flush_pending_text();
        self.parts.push(WordPart::Variable(name));
        self.word_started = true;
    }

    fn flush_pending_text(&mut self) {
        if self.pending.is_empty() {
            return;
        }
        let text = std::mem::take(&mut self.pending);
        self.parts.push(if self.pending_quoted {
            WordPart::Quoted(text)
        } else {
            WordPart::Bare(text)
        });
    }

    fn flush_word(&mut self) {
        self.flush_pending_text();
        if self.word_started {
            let mut parts = std::mem::take(&mut self.parts);
            // `""` / `''` alone must still produce an (empty) argument.
            if parts.is_empty() {
                parts.push(WordPart::Quoted(String::new()));
            }
            self.tokens.push(Token::Word(Word { parts }));
            self.word_started = false;
        } else {
            self.parts.clear();
        }
    }
}
