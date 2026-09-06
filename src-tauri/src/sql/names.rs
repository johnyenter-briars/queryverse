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
    // Dataverse entity-set names are metadata, not grammatical plurals. Keep known
    // platform exceptions here so connection-free FetchXML previews are accurate;
    // connected execution replaces this inference with EntityDefinition metadata.
    if name == "webresource" {
        return "webresourceset".to_string();
    }

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
    if matches!(name, "people" | "children") {
        return true;
    }

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

#[cfg(test)]
mod tests {
    use super::{entity_names, resolve_entity_names};

    #[test]
    fn resolves_singular_name_to_plural_entity_set() {
        let (entity_set, entity_logical) = resolve_entity_names("account");
        assert_eq!(entity_set, "accounts");
        assert_eq!(entity_logical, "account");
    }

    #[test]
    fn preserves_existing_plural_entity_set() {
        let names = entity_names("contacts");
        assert_eq!(names.entity_set, "contacts");
        assert_eq!(names.entity_logical, "contact");
    }

    #[test]
    fn handles_irregular_plurals() {
        let (entity_set, entity_logical) = resolve_entity_names("people");
        assert_eq!(entity_set, "people");
        assert_eq!(entity_logical, "person");
    }

    #[test]
    fn handles_dataverse_webresource_entity_set() {
        let (entity_set, entity_logical) = resolve_entity_names("webresource");
        assert_eq!(entity_set, "webresourceset");
        assert_eq!(entity_logical, "webresource");
    }

    #[test]
    fn trims_and_normalizes_case() {
        let (entity_set, entity_logical) = resolve_entity_names("  Accounts  ");
        assert_eq!(entity_set, "accounts");
        assert_eq!(entity_logical, "account");
    }
}
