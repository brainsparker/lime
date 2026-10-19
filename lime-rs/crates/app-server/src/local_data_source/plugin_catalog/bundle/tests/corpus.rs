use super::*;
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Deserialize)]
struct Corpus {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    id: String,
    file: String,
    sha256: String,
    archive_accepted: bool,
    expanded_limit: Option<u64>,
    manifest_accepted: Option<bool>,
    manifest_path: Option<String>,
    manifest_hash: Option<String>,
    #[serde(default)]
    files: BTreeMap<String, String>,
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[test]
fn bundle_shared_corpus_matches_core_archive_and_manifest_contract() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/plugin-archive");
    let corpus: Corpus =
        serde_json::from_slice(&fs::read(fixtures.join("index.json")).unwrap()).unwrap();
    assert_eq!(corpus.cases.len(), 75);
    for case in corpus.cases {
        let bytes = fs::read(fixtures.join(&case.file)).unwrap();
        assert_eq!(hash(&bytes), case.sha256, "{} fixture drift", case.id);
        let result = extract_bytes(&bytes, case.expanded_limit.unwrap_or(MAX_PACKAGE_BYTES));
        assert_eq!(
            result.is_ok(),
            case.archive_accepted,
            "{}: {result:?}",
            case.id
        );
        let Ok(directory) = result else { continue };
        for (path, expected) in &case.files {
            assert_eq!(
                hash(&fs::read(directory.path().join(path)).unwrap()),
                *expected,
                "{} file {path}",
                case.id
            );
        }
        let Some(accepted) = case.manifest_accepted else {
            continue;
        };
        let result = manifest::read_manifest_with_name(directory.path(), Some("example"));
        assert_eq!(result.is_ok(), accepted, "{} manifest: {result:?}", case.id);
        if !accepted {
            continue;
        }
        let selected = manifest::find_manifest_path(directory.path()).unwrap();
        assert_eq!(
            selected.strip_prefix(directory.path()).unwrap(),
            Path::new(case.manifest_path.as_ref().unwrap()),
            "{} manifest path",
            case.id
        );
        assert_eq!(
            hash(&fs::read(&selected).unwrap()),
            *case.manifest_hash.as_ref().unwrap(),
            "{} manifest bytes",
            case.id
        );
    }
}
