use super::*;

pub(super) fn parse(
    input: &str,
    explicit_ref: Option<String>,
    sparse_paths: Vec<String>,
    home: Option<&Path>,
) -> Result<MarketplaceConfig, Error> {
    let input = input.trim();
    if input.is_empty() {
        return Err(invalid("marketplace source must not be empty"));
    }
    let (base, suffix) = if let Some((base, suffix)) = input.rsplit_once('#') {
        (base, Some(suffix))
    } else if !is_local(input) && !input.contains("://") && !input.starts_with("git@") {
        input
            .rsplit_once('@')
            .map_or((input, None), |(base, suffix)| (base, Some(suffix)))
    } else {
        (input, None)
    };
    let ref_name = explicit_ref.or_else(|| {
        suffix
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
    });
    if is_local(base) {
        if ref_name.is_some() || !sparse_paths.is_empty() {
            return Err(invalid(
                "ref and sparsePaths are only supported for Git marketplace sources",
            ));
        }
        let path = if let Some(relative) = base.strip_prefix("~/") {
            home.ok_or_else(|| invalid("home directory is unavailable"))?
                .join(relative)
        } else {
            PathBuf::from(base)
        };
        let path = fs::canonicalize(path)
            .map_err(|e| invalid(format!("failed to resolve local marketplace: {e}")))?;
        if !path.is_dir() {
            return Err(invalid(
                "local marketplace source must be a directory, not a file",
            ));
        }
        return Ok(MarketplaceConfig {
            source_type: Some(MarketplaceSourceType::Local),
            source: Some(path.to_string_lossy().into_owned()),
            ..Default::default()
        });
    }
    let source = if base.starts_with("https://")
        || base.starts_with("http://")
        || base.starts_with("ssh://")
        || (base.starts_with("git@") && base.contains(':'))
    {
        let base = base.trim_end_matches('/');
        if base.starts_with("https://github.com/") && !base.ends_with(".git") {
            format!("{base}.git")
        } else {
            base.to_string()
        }
    } else if base.split('/').count() == 2
        && base.split('/').all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        })
    {
        format!("https://github.com/{base}.git")
    } else {
        return Err(invalid(
            "invalid marketplace source; expected owner/repo, a Git URL, or a local directory",
        ));
    };
    if ref_name
        .as_ref()
        .is_some_and(|s| s.is_empty() || s.starts_with('-') || s.contains('\0'))
    {
        return Err(invalid("invalid marketplace Git ref"));
    }
    for path in &sparse_paths {
        if path.is_empty()
            || path.starts_with(['-', '/', '\\'])
            || path.contains(['\0', '\n', '\r'])
            || path.split(['/', '\\']).any(|part| part == "..")
        {
            return Err(invalid("invalid marketplace sparse path"));
        }
    }
    Ok(MarketplaceConfig {
        source_type: Some(MarketplaceSourceType::Git),
        source: Some(source),
        ref_name,
        sparse_paths: Some(sparse_paths),
        ..Default::default()
    })
}

fn is_local(source: &str) -> bool {
    let bytes = source.as_bytes();
    Path::new(source).is_absolute()
        || ["./", ".\\", "../", "..\\", "~/", "\\\\"]
            .iter()
            .any(|prefix| source.starts_with(*prefix))
        || matches!(source, "." | "..")
        || (bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && matches!(bytes[2], b'/' | b'\\'))
}

pub(super) fn same_source(a: &MarketplaceConfig, b: &MarketplaceConfig) -> bool {
    a.source_type == b.source_type
        && a.source == b.source
        && a.ref_name == b.ref_name
        && a.sparse_paths.as_deref().unwrap_or_default()
            == b.sparse_paths.as_deref().unwrap_or_default()
}
