//! Writes the spec as a tree of YAML files:
//!
//! ```text
//! openapi/
//!   openapi.yaml                    info, tags, security; paths and schemas are $refs
//!   paths/<tag>/<path>.yaml         one path item per file, grouped by tag
//!   components/schemas/<Name>.yaml  one schema per file
//! ```
use std::fs;
use std::io;
use std::path::Path;

use serde_json::{Map, Value};

const HEADER: &str =
    "# Generated from the backend handlers (utoipa). Do not edit; run `cargo run -- openapi` in backend/.\n";
const SCHEMA_REF: &str = "#/components/schemas/";

pub fn write(dir: &Path) -> io::Result<()> {
    let mut root = serde_json::to_value(super::spec()).map_err(io::Error::other)?;
    // Start clean so removed endpoints and schemas don't linger.
    for sub in ["paths", "components"] {
        match fs::remove_dir_all(dir.join(sub)) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e),
            _ => {}
        }
    }

    let schemas = take_object(&mut root["components"]["schemas"]);
    let mut schema_refs = Map::new();
    for (name, mut schema) in schemas {
        relink(&mut schema, "./");
        write_yaml(&dir.join("components/schemas").join(format!("{name}.yaml")), &schema)?;
        schema_refs.insert(name.clone(), file_ref(&format!("./components/schemas/{name}.yaml")));
    }
    root["components"]["schemas"] = Value::Object(schema_refs);

    let paths = take_object(&mut root["paths"]);
    let mut path_refs = Map::new();
    for (path, mut item) in paths {
        let tag = first_tag(&item).unwrap_or("misc").to_owned();
        let file = format!("paths/{tag}/{}.yaml", slug(&path));
        relink(&mut item, "../../components/schemas/");
        write_yaml(&dir.join(&file), &item)?;
        path_refs.insert(path, file_ref(&format!("./{file}")));
    }
    root["paths"] = Value::Object(path_refs);

    write_yaml(&dir.join("openapi.yaml"), &root)
}

fn take_object(value: &mut Value) -> Map<String, Value> {
    match value.take() {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn file_ref(target: &str) -> Value {
    serde_json::json!({ "$ref": target })
}

/// `/api/servers/{id}/channels` -> `servers_id_channels`, `/api/users/@me` -> `users_me`
fn slug(path: &str) -> String {
    let trimmed = path.trim_start_matches("/api/").trim_matches('/');
    trimmed.replace(['{', '}', '@'], "").replace('/', "_")
}

fn first_tag(item: &Value) -> Option<&str> {
    let ops = item.as_object()?;
    ops.values().find_map(|op| op.get("tags")?.get(0)?.as_str())
}

/// Rewrites internal schema refs (`#/components/schemas/X`) into relative file refs (`<prefix>X.yaml`).
fn relink(value: &mut Value, prefix: &str) {
    match value {
        Value::Object(map) => {
            for (key, v) in map.iter_mut() {
                match v {
                    Value::String(target) if key == "$ref" => {
                        if let Some(name) = target.strip_prefix(SCHEMA_REF) {
                            *target = format!("{prefix}{name}.yaml");
                        }
                    }
                    _ => relink(v, prefix),
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|v| relink(v, prefix)),
        _ => {}
    }
}

fn write_yaml(path: &Path, value: &Value) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let body = serde_norway::to_string(value).map_err(io::Error::other)?;
    fs::write(path, format!("{HEADER}{body}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_are_flat_file_names() {
        assert_eq!(slug("/api/servers/{id}/channels"), "servers_id_channels");
        assert_eq!(slug("/api/auth/login"), "auth_login");
    }

    #[test]
    fn writes_split_tree_without_internal_schema_refs() {
        let dir = std::env::temp_dir().join(format!("glacier-openapi-{}", std::process::id()));
        write(&dir).unwrap();
        let root = fs::read_to_string(dir.join("openapi.yaml")).unwrap();
        assert!(root.contains("./paths/channels/servers_id_channels.yaml"));
        assert!(root.contains("./components/schemas/User.yaml"));
        let channels = fs::read_to_string(dir.join("paths/channels/servers_id_channels.yaml")).unwrap();
        assert!(channels.contains("../../components/schemas/Channel.yaml"));
        assert!(!channels.contains(SCHEMA_REF));
        fs::remove_dir_all(dir).unwrap();
    }
}
