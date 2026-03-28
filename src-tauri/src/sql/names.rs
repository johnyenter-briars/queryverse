pub(crate) struct EntityNames {
    pub(crate) entity_set: String,
    pub(crate) entity_logical: String,
}

pub(crate) fn entity_names(raw: &str) -> EntityNames {
    let normalized = raw.trim().to_ascii_lowercase();
    let logical = semantic_to_logical(&normalized);
    let entity_set = if looks_plural(&normalized) {
        normalized
    } else {
        pluralize(&normalized)
    };

    EntityNames {
        entity_set,
        entity_logical: logical,
    }
}

pub fn resolve_entity_names(raw: &str) -> (String, String) {
    let names = entity_names(raw);
    (names.entity_set, names.entity_logical)
}

fn semantic_to_logical(name: &str) -> String {
    match name {
        "people" => "person".to_string(),
        "children" => "child".to_string(),
        _ => singularize(name),
    }
}

fn singularize(name: &str) -> String {
    if name.ends_with("ies") && name.len() > 3 {
        return format!("{}y", &name[..name.len() - 3]);
    }

    if ends_with_any(name, &["ses", "xes", "zes", "ches", "shes"]) && name.len() > 2 {
        return name[..name.len() - 2].to_string();
    }

    if name.ends_with('s')
        && !name.ends_with("ss")
        && !name.ends_with("us")
        && !name.ends_with("is")
        && name.len() > 1
    {
        return name[..name.len() - 1].to_string();
    }

    name.to_string()
}

fn pluralize(name: &str) -> String {
    if name.ends_with('y')
        && name.len() > 1
        && !matches!(
            name.chars().nth(name.len() - 2),
            Some('a' | 'e' | 'i' | 'o' | 'u')
        )
    {
        return format!("{}ies", &name[..name.len() - 1]);
    }

    if ends_with_any(name, &["s", "x", "z", "ch", "sh"]) {
        return format!("{}es", name);
    }

    format!("{}s", name)
}

fn looks_plural(name: &str) -> bool {
    if ends_with_any(name, &["ies", "ses", "xes", "zes", "ches", "shes"]) {
        return true;
    }

    if name.ends_with('s')
        && !name.ends_with("us")
        && !name.ends_with("ss")
        && !name.ends_with("is")
        && name.len() > 1
    {
        return true;
    }

    false
}

fn ends_with_any(name: &str, suffixes: &[&str]) -> bool {
    suffixes.iter().any(|suffix| name.ends_with(suffix))
}
