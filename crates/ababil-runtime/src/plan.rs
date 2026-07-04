//! Lowering pass: AST -> execution plan. The parser never feeds the executor
//! directly; this layer is where future optimizations land (constant word
//! folding, builtin fast paths, pipeline fusion) without touching parser or
//! executor.

use ababil_parser::ast::{Connector, Program, Redirect, Word};

#[derive(Debug, Clone, Default)]
pub struct ExecutionPlan {
    pub steps: Vec<PlanStep>,
}

/// One `;`-separated sequence: pipelines chained by `&&` / `||`.
#[derive(Debug, Clone)]
pub struct PlanStep {
    pub first: PipelinePlan,
    pub rest: Vec<(Connector, PipelinePlan)>,
}

#[derive(Debug, Clone)]
pub struct PipelinePlan {
    pub commands: Vec<CommandPlan>,
}

#[derive(Debug, Clone)]
pub struct CommandPlan {
    pub words: Vec<Word>,
    pub redirects: Vec<Redirect>,
}

pub fn lower(program: &Program) -> ExecutionPlan {
    ExecutionPlan {
        steps: program
            .sequences
            .iter()
            .map(|seq| PlanStep {
                first: lower_pipeline(&seq.first),
                rest: seq
                    .rest
                    .iter()
                    .map(|(c, p)| (*c, lower_pipeline(p)))
                    .collect(),
            })
            .collect(),
    }
}

fn lower_pipeline(p: &ababil_parser::ast::Pipeline) -> PipelinePlan {
    PipelinePlan {
        commands: p
            .commands
            .iter()
            .map(|c| CommandPlan {
                words: c.words.clone(),
                redirects: c.redirects.clone(),
            })
            .collect(),
    }
}
