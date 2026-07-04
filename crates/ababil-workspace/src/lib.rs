//! Workspace layout model: what gets persisted and restored across app
//! restarts (tabs, split panes, per-pane cwd). Named workspaces build on
//! these types in the sessions phase; running processes are never revived.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Workspace {
    pub name: String,
    pub tabs: Vec<Tab>,
    pub active_tab: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub title: Option<String>,
    pub root: PaneNode,
    pub active_pane: String,
}

/// Split-pane tree: leaves are terminal panes, branches are splits.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PaneNode {
    Pane(Pane),
    Split {
        direction: SplitDirection,
        /// Fraction of space per child; same length as `children`.
        sizes: Vec<f32>,
        children: Vec<PaneNode>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pane {
    pub id: String,
    pub cwd: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}
