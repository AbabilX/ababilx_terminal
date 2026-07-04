//! Built-in commands, implemented in Rust on `std::fs`/native APIs — never by
//! shelling out.

mod env;
mod files;
mod misc;
mod nav;

use std::collections::BTreeMap;

use crate::exec::Effect;
use crate::state::ShellState;
use crate::traits::{FileSystem, OutputSink};

pub struct BuiltinCtx<'a> {
    pub state: &'a mut ShellState,
    pub fs: &'a dyn FileSystem,
    /// Piped stdin, when this builtin is a pipeline stage.
    pub input: Option<&'a [u8]>,
    pub registry: &'a BuiltinRegistry,
}

pub struct BuiltinResult {
    pub status: i32,
    pub effect: Option<Effect>,
}

impl BuiltinResult {
    pub fn ok() -> Self {
        Self { status: 0, effect: None }
    }
    pub fn fail(status: i32) -> Self {
        Self { status, effect: None }
    }
    pub fn effect(effect: Effect) -> Self {
        Self { status: 0, effect: Some(effect) }
    }
}

pub trait Builtin: Send + Sync {
    fn name(&self) -> &'static str;
    fn summary(&self) -> &'static str;
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult;
}

pub struct BuiltinRegistry {
    // BTreeMap keeps `help` output sorted for free.
    commands: BTreeMap<&'static str, Box<dyn Builtin>>,
}

impl BuiltinRegistry {
    pub fn with_defaults() -> Self {
        let mut registry = Self { commands: BTreeMap::new() };
        for builtin in [
            Box::new(nav::Pwd) as Box<dyn Builtin>,
            Box::new(nav::Cd),
            Box::new(nav::Ls),
            Box::new(files::Cat),
            Box::new(files::Mkdir),
            Box::new(files::Touch),
            Box::new(files::Rm),
            Box::new(files::Cp),
            Box::new(files::Mv),
            Box::new(env::Export),
            Box::new(env::Alias),
            Box::new(env::Unalias),
            Box::new(misc::Echo),
            Box::new(misc::Clear),
            Box::new(misc::Exit),
            Box::new(misc::History),
            Box::new(misc::Which),
            Box::new(misc::Help),
        ] {
            registry.commands.insert(builtin.name(), builtin);
        }
        registry
    }

    pub fn get(&self, name: &str) -> Option<&dyn Builtin> {
        self.commands.get(name).map(|b| b.as_ref())
    }

    pub fn contains(&self, name: &str) -> bool {
        self.commands.contains_key(name)
    }

    pub fn iter(&self) -> impl Iterator<Item = &dyn Builtin> {
        self.commands.values().map(|b| b.as_ref())
    }
}
