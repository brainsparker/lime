use super::*;
use crate::{build_agent_skill_snapshot_from_roots, AgentSkillRoot, AgentSkillScope};
use tempfile::TempDir;

#[test]
fn plugin_namespace_preserves_package_identity_and_does_not_select_bare_leaf() {
    let first = TempDir::new().unwrap();
    let second = TempDir::new().unwrap();
    write_skill(first.path(), "writer", "Writer");
    write_skill(second.path(), "writer", "Writer");
    let mut snapshot = build_agent_skill_snapshot_from_roots([
        AgentSkillRoot {
            path: first.path().to_path_buf(),
            scope: AgentSkillScope::App,
        },
        AgentSkillRoot {
            path: second.path().to_path_buf(),
            scope: AgentSkillScope::App,
        },
    ]);
    for (index, skill) in snapshot.skills.iter_mut().enumerate() {
        skill.name = "content:writer".to_string();
        skill.skill_id = format!("plugin:content@market-{index}:writer");
    }
    assert!(select_explicit_agent_skills("$writer", &snapshot).is_empty());
    let selections = select_explicit_agent_skills("$content:writer", &snapshot);
    assert_eq!(selections.len(), 1);
    assert_eq!(
        evaluate_agent_skill_selection_bodies(&selections, &snapshot, 3000)[0].skill_id,
        snapshot.skills[0].skill_id
    );
    let selections = select_explicit_agent_skills(
        &format!(
            "{} {}",
            snapshot.skills[0].skill_file_path.display(),
            snapshot.skills[1].skill_file_path.display()
        ),
        &snapshot,
    );
    assert_eq!(selections.len(), 2);
    let evaluations = evaluate_agent_skill_selection_bodies(&selections, &snapshot, 3000);
    assert_ne!(evaluations[0].skill_id, evaluations[1].skill_id);
}

#[test]
fn selects_unique_skill_from_dollar_mention() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "writer", "Writer");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_explicit_agent_skills("请用 $writer 改写", &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "writer");
    assert_eq!(
        selections[0].trigger,
        AgentSkillSelectionTrigger::DollarMention
    );
}

#[test]
fn selects_unique_skill_from_slash_mention() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "summary", "Summary");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_explicit_agent_skills("/summary 这段内容", &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "summary");
    assert_eq!(
        selections[0].trigger,
        AgentSkillSelectionTrigger::SlashMention
    );
}

#[test]
fn selects_unique_skill_from_at_mention() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "writer", "Writer");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_explicit_agent_skills("请用 @writer 改写", &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "writer");
    assert_eq!(selections[0].trigger, AgentSkillSelectionTrigger::AtMention);
}

#[test]
fn selects_skill_from_local_skill_file_path() {
    let root = TempDir::new().expect("root");
    let skill_file = write_skill(root.path(), "analysis", "Analysis");
    let snapshot = snapshot_from_root(root.path());

    let selections =
        select_explicit_agent_skills(&format!("读取 {}", skill_file.display()), &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "analysis");
    assert_eq!(
        selections[0].trigger,
        AgentSkillSelectionTrigger::SkillFilePath
    );
}

#[test]
fn structured_selection_requires_an_enabled_snapshot_path() {
    let root = TempDir::new().expect("root");
    let skill_file = write_skill(root.path(), "analysis", "Analysis");
    let mut snapshot = snapshot_from_root(root.path());

    let selection = select_structured_agent_skill("wire-name", &skill_file, &snapshot)
        .expect("structured selection");
    assert_eq!(selection.locator.name, "analysis");
    assert_eq!(
        selection.locator.skill_file_path,
        std::fs::canonicalize(&skill_file).expect("canonical skill path")
    );

    snapshot.skills[0].enabled = false;
    assert!(select_structured_agent_skill("analysis", &skill_file, &snapshot).is_none());
    assert!(select_structured_agent_skill(
        "analysis",
        &root.path().join("missing/SKILL.md"),
        &snapshot,
    )
    .is_none());
}

#[test]
fn selects_skill_from_skill_uri() {
    let root = TempDir::new().expect("root");
    let skill_file = write_skill(root.path(), "research", "Research");
    let snapshot = snapshot_from_root(root.path());
    let skill_file_text = skill_file.to_string_lossy();
    let encoded = urlencoding::encode(&skill_file_text);

    let selections = select_explicit_agent_skills(&format!("用 skill://{encoded}"), &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "research");
    assert_eq!(selections[0].trigger, AgentSkillSelectionTrigger::SkillUri);
}

#[test]
fn selects_skill_from_markdown_skill_uri_link() {
    let root = TempDir::new().expect("root");
    let skill_file = write_skill(root.path(), "research", "Research");
    let snapshot = snapshot_from_root(root.path());
    let skill_file_text = skill_file.to_string_lossy();
    let encoded = urlencoding::encode(&skill_file_text);

    let selections =
        select_explicit_agent_skills(&format!("用 [research](skill://{encoded})"), &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "research");
    assert_eq!(selections[0].trigger, AgentSkillSelectionTrigger::SkillUri);
}

#[test]
fn explicit_selection_deduplicates_same_stable_skill_across_project_roots() {
    let first = TempDir::new().expect("first");
    let second = TempDir::new().expect("second");
    let first_skill = write_skill(first.path(), "research", "Research");
    let second_skill = write_skill(second.path(), "research", "Research");
    let snapshot = build_agent_skill_snapshot_from_roots([
        AgentSkillRoot {
            path: first.path().to_path_buf(),
            scope: AgentSkillScope::Project,
        },
        AgentSkillRoot {
            path: second.path().to_path_buf(),
            scope: AgentSkillScope::Project,
        },
    ]);

    let selections = select_explicit_agent_skills(
        &format!("{} {}", first_skill.display(), second_skill.display()),
        &snapshot,
    );

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "research");
}

#[test]
fn selects_unique_skill_from_structured_catalog_candidates() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "writer", "Writer");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_agent_skills_by_name_candidates(
        ["local:writer", "project:writer", "writer"],
        &snapshot,
        AgentSkillSelectionTrigger::CatalogBinding,
    );

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "writer");
    assert_eq!(
        selections[0].trigger,
        AgentSkillSelectionTrigger::CatalogBinding
    );
}

#[test]
fn structured_candidates_do_not_select_unknown_skill() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "writer", "Writer");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_agent_skills_by_name_candidates(
        ["service-skill-writer"],
        &snapshot,
        AgentSkillSelectionTrigger::CatalogBinding,
    );

    assert!(selections.is_empty());
}

#[test]
fn duplicate_skill_name_selects_first_enabled_catalog_entry() {
    let first = TempDir::new().expect("first");
    let second = TempDir::new().expect("second");
    write_skill(first.path(), "writer", "Writer");
    write_skill(second.path(), "writer", "Writer");
    let snapshot = build_agent_skill_snapshot_from_roots([
        AgentSkillRoot {
            path: first.path().to_path_buf(),
            scope: AgentSkillScope::Project,
        },
        AgentSkillRoot {
            path: second.path().to_path_buf(),
            scope: AgentSkillScope::User,
        },
    ]);

    let selections = select_explicit_agent_skills("$writer", &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(
        selections[0].locator.skill_file_path,
        snapshot.skills[0].skill_file_path
    );
}

#[test]
fn implicit_selection_loads_unique_high_confidence_skill() {
    let root = TempDir::new().expect("root");
    write_skill_with_description(
        root.path(),
        "research",
        "Research",
        "联网信息检索与事实核验",
    );
    write_skill_with_description(root.path(), "writer", "Writer", "写作润色");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_implicit_agent_skills("帮我做最新事实核验和趋势调研", &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "research");
    assert_eq!(
        selections[0].trigger,
        AgentSkillSelectionTrigger::ImplicitHighConfidence
    );
}

#[test]
fn implicit_selection_ignores_ambiguous_candidates() {
    let root = TempDir::new().expect("root");
    write_skill_with_description(root.path(), "summary", "Summary", "总结提炼文本重点");
    write_skill_with_description(root.path(), "analysis", "Analysis", "分析文本重点");
    let snapshot = snapshot_from_root(root.path());

    let selections = select_implicit_agent_skills("处理文本重点", &snapshot);

    assert!(selections.is_empty());
}

#[test]
fn implicit_selection_prefers_project_candidate_when_scores_are_close() {
    let project = TempDir::new().expect("project");
    let app = TempDir::new().expect("app");
    write_skill_with_description(
        project.path(),
        "fact-check-lab",
        "Fact Check Lab",
        "联网信息检索与事实核验",
    );
    write_skill_with_description(app.path(), "research", "Research", "事实核验与趋势调研");
    let snapshot = build_agent_skill_snapshot_from_roots([
        AgentSkillRoot {
            path: project.path().to_path_buf(),
            scope: AgentSkillScope::Project,
        },
        AgentSkillRoot {
            path: app.path().to_path_buf(),
            scope: AgentSkillScope::App,
        },
    ]);

    let selections = select_implicit_agent_skills("帮我做最新事实核验和趋势调研", &snapshot);

    assert_eq!(selections.len(), 1);
    assert_eq!(selections[0].locator.name, "fact-check-lab");
}

#[test]
fn selection_skips_disabled_skill_metadata() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "writer", "Writer");
    let mut snapshot = snapshot_from_root(root.path());
    snapshot.skills[0].enabled = false;
    snapshot.skills[0].policy.allow_implicit_invocation = false;

    assert!(select_explicit_agent_skills("$writer", &snapshot).is_empty());
    assert!(select_implicit_agent_skills("writer rewrite", &snapshot).is_empty());
}

#[test]
fn selection_body_budget_uses_real_bodies_and_omits_after_budget_is_consumed() {
    let root = TempDir::new().expect("root");
    write_skill(root.path(), "writer", "Writer");
    write_skill(root.path(), "summary", "Summary");
    let snapshot = snapshot_from_root(root.path());
    let selections = select_agent_skills_by_name_candidates(
        ["writer", "summary"],
        &snapshot,
        AgentSkillSelectionTrigger::CatalogBinding,
    );
    let first_budget = evaluate_agent_skill_body(&selections[0].locator, u32::MAX)
        .budget
        .estimated_tokens
        .expect("first body tokens");

    let evaluations = evaluate_agent_skill_selection_bodies(&selections, &snapshot, first_budget);

    assert_eq!(evaluations.len(), 2);
    assert_eq!(
        evaluations[0].decision,
        AgentSkillBodyBudgetDecisionKind::Allow
    );
    assert_eq!(evaluations[0].reason, "skill_selection_allowed");
    assert_eq!(evaluations[0].skill_id, "project:writer");
    assert_eq!(evaluations[0].source, Some(AgentSkillSource::Project));
    assert_eq!(
        evaluations[0].authority,
        Some(AgentSkillAuthority::Workspace)
    );
    assert_eq!(
        evaluations[1].decision,
        AgentSkillBodyBudgetDecisionKind::Omitted
    );
    assert_eq!(
        evaluations[1].reason,
        "skill_selection_body_omitted_by_token_budget"
    );
}

fn snapshot_from_root(root: &Path) -> AgentSkillSnapshot {
    build_agent_skill_snapshot_from_roots([AgentSkillRoot {
        path: root.to_path_buf(),
        scope: AgentSkillScope::Project,
    }])
}

fn write_skill(root: &Path, name: &str, display_name: &str) -> PathBuf {
    write_skill_with_description(root, name, display_name, "Test skill")
}

fn write_skill_with_description(
    root: &Path,
    name: &str,
    display_name: &str,
    description: &str,
) -> PathBuf {
    let skill_dir = root.join(name);
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    let skill_file = skill_dir.join("SKILL.md");
    std::fs::write(
        &skill_file,
        format!("---\nname: {display_name}\ndescription: {description}\n---\n\n# Body"),
    )
    .expect("skill");
    skill_file
}
