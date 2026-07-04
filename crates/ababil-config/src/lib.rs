//! Layered configuration, VSCode-style:
//!
//!   defaults.json -> user.json -> workspace.json -> project.json -> runtime overrides
//!
//! Later layers override earlier ones key-by-key (deep merge on objects).
//! File watching, schema validation and the settings UI build on this core in
//! the config phase; this crate stays IO-light so anything can host it.

use serde_json::{Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Layer {
    Defaults = 0,
    User = 1,
    Workspace = 2,
    Project = 3,
    Runtime = 4,
}

#[derive(Debug, Default)]
pub struct ConfigStore {
    layers: [Value; 5],
}

impl ConfigStore {
    pub fn new() -> Self {
        Self {
            layers: std::array::from_fn(|_| Value::Object(Map::new())),
        }
    }

    pub fn set_layer(&mut self, layer: Layer, value: Value) {
        self.layers[layer as usize] = value;
    }

    /// Effective config: all layers deep-merged, later layers win.
    pub fn effective(&self) -> Value {
        let mut merged = Value::Object(Map::new());
        for layer in &self.layers {
            deep_merge(&mut merged, layer);
        }
        merged
    }

    /// Dotted-path lookup into the effective config: `terminal.font.size`.
    pub fn get(&self, path: &str) -> Option<Value> {
        let mut current = self.effective();
        for key in path.split('.') {
            current = current.get(key)?.clone();
        }
        Some(current)
    }
}

/// Objects merge recursively; everything else (arrays included) replaces.
fn deep_merge(base: &mut Value, overlay: &Value) {
    match (base, overlay) {
        (Value::Object(base_map), Value::Object(overlay_map)) => {
            for (k, v) in overlay_map {
                match base_map.get_mut(k) {
                    Some(existing) => deep_merge(existing, v),
                    None => {
                        base_map.insert(k.clone(), v.clone());
                    }
                }
            }
        }
        (base, overlay) => *base = overlay.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn layers_override_in_order() {
        let mut store = ConfigStore::new();
        store.set_layer(
            Layer::Defaults,
            json!({"terminal": {"font": {"size": 14, "family": "Consolas"}}}),
        );
        store.set_layer(Layer::User, json!({"terminal": {"font": {"size": 16}}}));
        assert_eq!(store.get("terminal.font.size"), Some(json!(16)));
        assert_eq!(store.get("terminal.font.family"), Some(json!("Consolas")));

        store.set_layer(Layer::Runtime, json!({"terminal": {"font": {"size": 20}}}));
        assert_eq!(store.get("terminal.font.size"), Some(json!(20)));
        assert_eq!(store.get("missing.key"), None);
    }
}
