//! Recursive-descent parser over the token stream.
//!
//! Grammar (v1):
//!   program   := and_or (';' and_or)* ';'?
//!   and_or    := pipeline (('&&' | '||') pipeline)*
//!   pipeline  := command ('|' command)*
//!   command   := (word | redirect)+
//!   redirect  := ('<' | '>' | '>>') word

use crate::ast::*;
use crate::error::ParseError;
use crate::token::Token;

pub fn parse_tokens(tokens: &[Token]) -> Result<Program, ParseError> {
    Parser { tokens, pos: 0 }.program()
}

struct Parser<'a> {
    tokens: &'a [Token],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn peek(&self) -> Option<&'a Token> {
        self.tokens.get(self.pos)
    }

    fn next(&mut self) -> Option<&'a Token> {
        let t = self.tokens.get(self.pos);
        if t.is_some() {
            self.pos += 1;
        }
        t
    }

    fn program(&mut self) -> Result<Program, ParseError> {
        let mut sequences = Vec::new();
        loop {
            // Allow empty statements: `;;`, leading/trailing `;`.
            while self.peek() == Some(&Token::Semi) {
                self.pos += 1;
            }
            if self.peek().is_none() {
                break;
            }
            sequences.push(self.and_or()?);
        }
        Ok(Program { sequences })
    }

    fn and_or(&mut self) -> Result<AndOrList, ParseError> {
        let first = self.pipeline()?;
        let mut rest = Vec::new();
        loop {
            let connector = match self.peek() {
                Some(Token::And) => Connector::And,
                Some(Token::Or) => Connector::Or,
                _ => break,
            };
            self.pos += 1;
            let op = if connector == Connector::And { "&&" } else { "||" };
            if self.peek().is_none() {
                return Err(ParseError::UnexpectedEof(op.into()));
            }
            rest.push((connector, self.pipeline()?));
        }
        Ok(AndOrList { first, rest })
    }

    fn pipeline(&mut self) -> Result<Pipeline, ParseError> {
        let mut commands = vec![self.command()?];
        while self.peek() == Some(&Token::Pipe) {
            self.pos += 1;
            if self.peek().is_none() {
                return Err(ParseError::UnexpectedEof("|".into()));
            }
            commands.push(self.command()?);
        }
        Ok(Pipeline { commands })
    }

    fn command(&mut self) -> Result<SimpleCommand, ParseError> {
        let mut cmd = SimpleCommand::default();
        loop {
            match self.peek() {
                Some(Token::Word(w)) => {
                    cmd.words.push(w.clone());
                    self.pos += 1;
                }
                Some(t @ (Token::RedirIn | Token::RedirOut | Token::RedirAppend)) => {
                    let kind = match t {
                        Token::RedirIn => RedirectKind::In,
                        Token::RedirOut => RedirectKind::Out,
                        _ => RedirectKind::Append,
                    };
                    let op = t.display().to_string();
                    self.pos += 1;
                    match self.next() {
                        Some(Token::Word(target)) => cmd.redirects.push(Redirect {
                            kind,
                            target: target.clone(),
                        }),
                        _ => return Err(ParseError::MissingRedirectTarget(op)),
                    }
                }
                _ => break,
            }
        }
        if cmd.words.is_empty() && cmd.redirects.is_empty() {
            let found = self
                .peek()
                .map(|t| t.display().to_string())
                .unwrap_or_else(|| "end of input".into());
            return Err(ParseError::UnexpectedToken(found));
        }
        Ok(cmd)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse;

    fn bare(s: &str) -> Word {
        Word {
            parts: vec![WordPart::Bare(s.into())],
        }
    }

    #[test]
    fn simple_command() {
        let p = parse("ls -la src").unwrap();
        assert_eq!(p.sequences.len(), 1);
        let cmd = &p.sequences[0].first.commands[0];
        assert_eq!(cmd.words, vec![bare("ls"), bare("-la"), bare("src")]);
    }

    #[test]
    fn pipeline_and_connectors() {
        let p = parse("a | b && c || d ; e").unwrap();
        assert_eq!(p.sequences.len(), 2);
        let seq = &p.sequences[0];
        assert_eq!(seq.first.commands.len(), 2);
        assert_eq!(seq.rest.len(), 2);
        assert_eq!(seq.rest[0].0, Connector::And);
        assert_eq!(seq.rest[1].0, Connector::Or);
    }

    #[test]
    fn quoting_preserves_parts_in_order() {
        let p = parse("echo pre'mid'post").unwrap();
        let w = &p.sequences[0].first.commands[0].words[1];
        assert_eq!(
            w.parts,
            vec![
                WordPart::Bare("pre".into()),
                WordPart::Quoted("mid".into()),
                WordPart::Bare("post".into()),
            ]
        );
    }

    #[test]
    fn variables() {
        let p = parse(r#"echo $HOME "v=${VAR}x" '$NOPE'"#).unwrap();
        let words = &p.sequences[0].first.commands[0].words;
        assert_eq!(words[1].parts, vec![WordPart::Variable("HOME".into())]);
        assert_eq!(
            words[2].parts,
            vec![
                WordPart::Quoted("v=".into()),
                WordPart::Variable("VAR".into()),
                WordPart::Quoted("x".into()),
            ]
        );
        assert_eq!(words[3].parts, vec![WordPart::Quoted("$NOPE".into())]);
    }

    #[test]
    fn redirects() {
        let p = parse("sort < in.txt > out.txt; log >> app.log").unwrap();
        let cmd = &p.sequences[0].first.commands[0];
        assert_eq!(cmd.redirects.len(), 2);
        assert_eq!(cmd.redirects[0].kind, RedirectKind::In);
        assert_eq!(cmd.redirects[1].kind, RedirectKind::Out);
        let cmd2 = &p.sequences[1].first.commands[0];
        assert_eq!(cmd2.redirects[0].kind, RedirectKind::Append);
    }

    #[test]
    fn empty_quotes_make_empty_arg() {
        let p = parse(r#"printf "" x"#).unwrap();
        let words = &p.sequences[0].first.commands[0].words;
        assert_eq!(words.len(), 3);
        assert_eq!(words[1].parts, vec![WordPart::Quoted(String::new())]);
    }

    #[test]
    fn escapes() {
        let p = parse(r"echo a\ b").unwrap();
        let words = &p.sequences[0].first.commands[0].words;
        assert_eq!(words.len(), 2);
        assert_eq!(
            words[1].parts,
            vec![
                WordPart::Bare("a".into()),
                WordPart::Quoted(" ".into()),
                WordPart::Bare("b".into()),
            ]
        );
    }

    #[test]
    fn errors() {
        assert_eq!(parse("echo 'x").unwrap_err(), ParseError::UnterminatedSingleQuote);
        assert_eq!(parse("a &&").unwrap_err(), ParseError::UnexpectedEof("&&".into()));
        assert_eq!(
            parse("a >").unwrap_err(),
            ParseError::MissingRedirectTarget(">".into())
        );
        assert!(matches!(parse("a & b"), Err(ParseError::UnexpectedToken(_))));
        assert!(matches!(parse("| a"), Err(ParseError::UnexpectedToken(_))));
    }

    #[test]
    fn empty_input_ok() {
        assert!(parse("").unwrap().sequences.is_empty());
        assert!(parse("  ; ;; ").unwrap().sequences.is_empty());
    }
}
