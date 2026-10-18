use app_server::{AppServer, LocalAppDataSource, MockBackend, RuntimeCore};
use lime_core::database::schema::create_tables;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn server(temp: &TempDir) -> AppServer {
    let db = Connection::open_in_memory().unwrap();
    create_tables(&db).unwrap();
    let data = LocalAppDataSource::initialize_with_roots(
        Arc::new(Mutex::new(db)),
        temp.path(),
        temp.path().join("agent"),
    )
    .await
    .unwrap()
    .with_app_config_path(temp.path().join("config.yaml"))
    .with_plugin_discovery_roots(None, None);
    let server = AppServer::with_runtime(
        RuntimeCore::with_backend(Arc::new(MockBackend))
            .with_app_config_path(temp.path().join("config.yaml"))
            .with_app_data_source(Arc::new(data)),
    );
    rpc(
        &server,
        "initialize",
        json!({"clientInfo":{"name":"marketplace-jsonrpc-test","version":"1"}}),
    )
    .await;
    server
        .handle_json_line(&json!({"jsonrpc":"2.0","method":"initialized","params":{}}).to_string())
        .await
        .unwrap();
    server
}

async fn raw_rpc(server: &AppServer, method: &str, params: Value) -> Value {
    messages(server, method, params)
        .await
        .into_iter()
        .find(|message| message.get("id") == Some(&json!(1)))
        .expect("response for marketplace request")
}

async fn messages(server: &AppServer, method: &str, params: Value) -> Vec<Value> {
    server
        .handle_json_line(
            &json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}).to_string(),
        )
        .await
        .unwrap()
        .iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .collect()
}

async fn rpc(server: &AppServer, method: &str, params: Value) -> Value {
    let response = raw_rpc(server, method, params).await;
    assert!(response.get("error").is_none(), "{method}: {response:#}");
    response["result"].clone()
}

#[tokio::test]
async fn public_local_marketplace_reference_config_and_removal_use_one_owner() {
    let temp = TempDir::new().unwrap();
    let source = temp.path().join("local");
    fs::create_dir_all(source.join(".agents/plugins")).unwrap();
    fs::write(
        source.join(".agents/plugins/marketplace.json"),
        json!({"name":"local","plugins":[]}).to_string(),
    )
    .unwrap();
    let server = server(&temp).await;
    let added = rpc(&server, "marketplace/add", json!({"source":source})).await;
    assert_eq!(
        added,
        json!({"marketplaceName":"local","installedRoot":fs::canonicalize(&source).unwrap(),"alreadyAdded":false})
    );
    assert_eq!(
        rpc(&server, "marketplace/add", json!({"source":source})).await["alreadyAdded"],
        true
    );
    let listed = rpc(&server, "plugin/list", json!({})).await;
    assert_eq!(listed["marketplaces"][0]["name"], "local");
    assert_eq!(listed["marketplaceLoadErrors"], json!([]));
    let config = rpc(&server, "config/read", json!({})).await;
    assert_eq!(
        config["config"]["marketplaces"]["local"]["source_type"],
        "local"
    );
    assert_eq!(
        rpc(&server, "marketplace/upgrade", json!({})).await,
        json!({"selectedMarketplaces":[],"upgradedRoots":[],"errors":[]})
    );
    for name in ["local", "missing"] {
        let response = raw_rpc(
            &server,
            "marketplace/upgrade",
            json!({"marketplaceName":name}),
        )
        .await;
        assert!(
            response["error"]["message"]
                .as_str()
                .is_some_and(|message| message.contains("not configured as a Git marketplace")),
            "explicit non-Git marketplace {name} must fail: {response:#}"
        );
    }
    let invalid = raw_rpc(
        &server,
        "marketplace/remove",
        json!({"marketplaceName":"LOCAL"}),
    )
    .await;
    assert!(invalid["error"]["message"]
        .as_str()
        .unwrap()
        .contains("exactly match"));
    // A missing configured source is a per-marketplace error, not silently absent.
    fs::remove_file(source.join(".agents/plugins/marketplace.json")).unwrap();
    assert_eq!(
        rpc(&server, "plugin/list", json!({})).await["marketplaceLoadErrors"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        rpc(
            &server,
            "marketplace/remove",
            json!({"marketplaceName":"local"})
        )
        .await,
        json!({"marketplaceName":"local","installedRoot":null})
    );
    assert!(source.is_dir());
    assert!(rpc(&server, "plugin/list", json!({})).await["marketplaces"]
        .as_array()
        .unwrap()
        .is_empty());
    assert!(raw_rpc(
        &server,
        "marketplace/remove",
        json!({"marketplaceName":"local"})
    )
    .await
    .get("error")
    .is_some());
}

#[tokio::test]
async fn public_git_marketplace_add_upgrade_install_and_failed_upgrade_preserve_state() {
    let remote = GitRemote::new().await;
    remote.publish("team", "1.0.0");
    let temp = TempDir::new().unwrap();
    let server = server(&temp).await;
    let added = rpc(
        &server,
        "marketplace/add",
        json!({"source":remote.url,"refName":"main","sparsePaths":[".agents","plugins"]}),
    )
    .await;
    let root = PathBuf::from(added["installedRoot"].as_str().unwrap());
    assert!(root.ends_with(".tmp/marketplaces/team"));
    assert!(root.join("plugins/proof/plugin.json").is_file());
    assert_eq!(
        rpc(
            &server,
            "marketplace/add",
            json!({"source":remote.url,"refName":"main","sparsePaths":[".agents","plugins"]})
        )
        .await["alreadyAdded"],
        true
    );
    assert_eq!(
        rpc(&server, "marketplace/upgrade", json!({})).await,
        json!({"selectedMarketplaces":["team"],"upgradedRoots":[],"errors":[]})
    );

    remote.publish("team", "2.0.0");
    assert_eq!(
        rpc(
            &server,
            "marketplace/upgrade",
            json!({"marketplaceName":"team"})
        )
        .await,
        json!({"selectedMarketplaces":["team"],"upgradedRoots":[root],"errors":[]})
    );
    let listed = rpc(&server, "plugin/list", json!({})).await;
    let market = &listed["marketplaces"][0];
    assert_eq!(market["plugins"][0]["id"], "proof@team");
    assert_eq!(market["plugins"][0]["version"], "2.0.0");
    assert_eq!(
        rpc(
            &server,
            "plugin/install",
            json!({"marketplacePath":market["path"],"pluginName":"proof"})
        )
        .await,
        json!({"authPolicy":"ON_USE","appsNeedingAuth":[]})
    );
    let installed = temp
        .path()
        .join("agent/plugins/cache/team/proof/2.0.0/plugin.json");
    assert!(installed.is_file());
    let before = fs::read(&installed).unwrap();
    let config_before = fs::read(temp.path().join("config.yaml")).unwrap();

    // An upstream rename must fail validation and retain the active snapshot/config.
    remote.publish("renamed", "3.0.0");
    let failed = rpc(
        &server,
        "marketplace/upgrade",
        json!({"marketplaceName":"team"}),
    )
    .await;
    assert_eq!(failed["selectedMarketplaces"], json!(["team"]));
    assert_eq!(failed["upgradedRoots"], json!([]));
    assert_eq!(failed["errors"][0]["marketplaceName"], "team");
    assert!(failed["errors"][0]["message"]
        .as_str()
        .unwrap()
        .contains("does not match"));
    assert_eq!(
        fs::read(temp.path().join("config.yaml")).unwrap(),
        config_before
    );
    assert_eq!(
        rpc(&server, "plugin/list", json!({})).await["marketplaces"][0]["plugins"][0]["version"],
        "2.0.0"
    );
    assert_eq!(fs::read(&installed).unwrap(), before);

    assert_eq!(
        rpc(
            &server,
            "marketplace/remove",
            json!({"marketplaceName":"team"})
        )
        .await,
        json!({"marketplaceName":"team","installedRoot":root})
    );
    assert!(!root.exists());
    assert_eq!(fs::read(installed).unwrap(), before);
    assert_eq!(
        rpc(&server, "config/read", json!({})).await["config"]["plugins"]["proof@team"]["enabled"],
        true
    );
}

#[tokio::test]
async fn public_upgrade_isolates_failed_marketplace_and_continues_other_sources() {
    let bad = GitRemote::new().await;
    let good = GitRemote::new().await;
    bad.publish("a-bad", "1.0.0");
    good.publish("z-good", "1.0.0");
    let temp = TempDir::new().unwrap();
    let server = server(&temp).await;
    for source in [&bad.url, &good.url] {
        rpc(&server, "marketplace/add", json!({"source":source})).await;
    }
    bad.publish("renamed", "2.0.0");
    good.publish("z-good", "2.0.0");
    let result = rpc(&server, "marketplace/upgrade", json!({})).await;
    assert_eq!(result["selectedMarketplaces"], json!(["a-bad", "z-good"]));
    assert_eq!(result["upgradedRoots"].as_array().unwrap().len(), 1);
    assert!(result["upgradedRoots"][0]
        .as_str()
        .unwrap()
        .ends_with("z-good"));
    assert_eq!(result["errors"].as_array().unwrap().len(), 1);
    assert_eq!(result["errors"][0]["marketplaceName"], "a-bad");
    let listed = rpc(&server, "plugin/list", json!({})).await;
    let versions = listed["marketplaces"]
        .as_array()
        .unwrap()
        .iter()
        .map(|market| {
            (
                market["name"].as_str().unwrap(),
                market["plugins"][0]["version"].as_str().unwrap(),
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    assert_eq!(
        versions,
        std::collections::BTreeMap::from([("a-bad", "1.0.0"), ("z-good", "2.0.0")])
    );
}

#[tokio::test]
async fn public_upgrade_refreshes_configured_cache_and_skills_without_changing_enablement() {
    let remote = GitRemote::new().await;
    remote.publish_plugins(
        "team",
        &[
            ("proof", "1.0.0", "Before"),
            ("sleeping", "1.0.0", "Disabled"),
        ],
        None,
    );
    let temp = TempDir::new().unwrap();
    let server = server(&temp).await;
    let added = rpc(&server, "marketplace/add", json!({"source":remote.url})).await;
    let market = PathBuf::from(added["installedRoot"].as_str().unwrap())
        .join(".agents/plugins/marketplace.json");
    for name in ["proof", "sleeping"] {
        rpc(
            &server,
            "plugin/install",
            json!({"marketplacePath":market,"pluginName":name}),
        )
        .await;
    }
    let outside = GitRemote::new().await;
    outside.publish_plugins("outside", &[("outside", "1.0.0", "Outside")], None);
    let other = rpc(&server, "marketplace/add", json!({"source":outside.url})).await;
    let other_market = PathBuf::from(other["installedRoot"].as_str().unwrap())
        .join(".agents/plugins/marketplace.json");
    rpc(
        &server,
        "plugin/install",
        json!({"marketplacePath":other_market,"pluginName":"outside"}),
    )
    .await;
    outside.publish_plugins("outside", &[("outside", "2.0.0", "Outside pending")], None);
    rpc(&server, "config/batchWrite", json!({"edits":[{"keyPath":"plugins.\"sleeping@team\".enabled","value":false,"mergeStrategy":"replace"}]})).await;
    let config_before = rpc(&server, "config/read", json!({})).await["config"]["plugins"].clone();
    let skills = rpc(&server, "skills/list", json!({"cwds":[temp.path()]})).await;
    assert_eq!(plugin_skill(&skills)["description"], "Before");
    let cache = temp.path().join("agent/plugins/cache/team");
    for (version, description) in [("2.0.0", "After"), ("2.0.0", "Same version new content")] {
        remote.publish_plugins(
            "team",
            &[
                ("proof", version, description),
                ("sleeping", version, "Still disabled"),
                ("unused", version, "Unconfigured"),
            ],
            None,
        );
        let mut outbound = server.subscribe_outbound_messages();
        let upgraded = messages(
            &server,
            "marketplace/upgrade",
            json!({"marketplaceName":"team"}),
        )
        .await;
        let result = upgraded.iter().find(|message| message["id"] == 1).unwrap();
        assert_eq!(result["result"]["errors"], json!([]), "{upgraded:#?}");
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            loop {
                let notification = serde_json::to_value(outbound.recv().await.unwrap()).unwrap();
                if notification["method"] == "skills/changed" {
                    assert_eq!(notification["params"], json!({}));
                    break;
                }
            }
        })
        .await
        .expect("upgrade must broadcast skills/changed to connected consumers");
        for name in ["proof", "sleeping"] {
            let path = cache.join(name).join(version).join("skills/check/SKILL.md");
            assert!(
                path.is_file(),
                "configured cache must refresh: {}",
                path.display()
            );
            assert!(!cache.join(name).join("1.0.0").exists());
        }
        assert!(
            !cache.join("unused").exists(),
            "unconfigured plugin must not be materialized"
        );
        assert!(
            temp.path()
                .join("agent/plugins/cache/outside/outside/1.0.0/plugin.json")
                .is_file(),
            "unselected marketplace cache must stay unchanged"
        );
        assert!(!temp
            .path()
            .join("agent/plugins/cache/outside/outside/2.0.0")
            .exists());
        assert_eq!(
            rpc(&server, "config/read", json!({})).await["config"]["plugins"],
            config_before
        );
        let skills = rpc(&server, "skills/list", json!({"cwds":[temp.path()]})).await;
        assert_eq!(
            plugin_skill(&skills)["description"],
            description,
            "cached Skills catalog must refresh"
        );
        assert!(!skills["data"][0]["skills"]
            .as_array()
            .unwrap()
            .iter()
            .any(|skill| skill["name"] == "sleeping:check"));
    }
    // A fresh host has no delayed OS watch events from the preceding cache replacements.
    let fresh = self::server(&temp).await;
    let mut outbound = fresh.subscribe_outbound_messages();
    let unchanged = rpc(
        &fresh,
        "marketplace/upgrade",
        json!({"marketplaceName":"team"}),
    )
    .await;
    assert_eq!(unchanged["upgradedRoots"], json!([]));
    assert!(
        outbound.try_recv().is_err(),
        "no-op must not broadcast notifications"
    );
}

#[tokio::test]
#[cfg(unix)]
async fn public_upgrade_isolates_failed_plugin_refresh_and_retains_its_previous_cache() {
    let remote = GitRemote::new().await;
    remote.publish_plugins(
        "team",
        &[
            ("proof", "1.0.0", "Before"),
            ("other", "1.0.0", "Other before"),
        ],
        None,
    );
    let temp = TempDir::new().unwrap();
    let server = server(&temp).await;
    let added = rpc(&server, "marketplace/add", json!({"source":remote.url})).await;
    let market = PathBuf::from(added["installedRoot"].as_str().unwrap())
        .join(".agents/plugins/marketplace.json");
    for name in ["proof", "other"] {
        rpc(
            &server,
            "plugin/install",
            json!({"marketplacePath":market,"pluginName":name}),
        )
        .await;
    }
    let old = temp
        .path()
        .join("agent/plugins/cache/team/proof/1.0.0/plugin.json");
    let before = fs::read(&old).unwrap();
    remote.publish_plugins(
        "team",
        &[
            ("proof", "2.0.0", "Broken package"),
            ("other", "2.0.0", "Other after"),
        ],
        Some("proof"),
    );
    let result = rpc(
        &server,
        "marketplace/upgrade",
        json!({"marketplaceName":"team"}),
    )
    .await;
    assert_eq!(result["upgradedRoots"].as_array().unwrap().len(), 1);
    assert_eq!(result["errors"].as_array().unwrap().len(), 1, "{result:#}");
    assert_eq!(result["errors"][0]["marketplaceName"], "team");
    assert!(result["errors"][0]["message"]
        .as_str()
        .unwrap()
        .contains("proof@team"));
    assert_eq!(fs::read(&old).unwrap(), before);
    assert!(!old
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("2.0.0")
        .exists());
    assert!(temp
        .path()
        .join("agent/plugins/cache/team/other/2.0.0/plugin.json")
        .is_file());
}

fn plugin_skill(skills: &Value) -> &Value {
    skills["data"][0]["skills"]
        .as_array()
        .unwrap()
        .iter()
        .find(|skill| skill["name"] == "proof:check")
        .unwrap_or_else(|| panic!("proof:check must be in catalog: {skills:#}"))
}

struct GitRemote {
    directory: TempDir,
    url: String,
    task: tokio::task::JoinHandle<()>,
}

impl Drop for GitRemote {
    fn drop(&mut self) {
        self.task.abort();
    }
}

impl GitRemote {
    async fn new() -> Self {
        let directory = TempDir::new().unwrap();
        git(
            directory.path(),
            &["init", "--bare", "--initial-branch=main"],
        );
        let root = directory.path().to_path_buf();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/market.git", listener.local_addr().unwrap());
        // Real Git dumb-HTTP fixture: serve objects/refs from an isolated bare repository.
        let task = tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                let root = root.clone();
                tokio::spawn(async move {
                    let mut request = vec![0; 8192];
                    let Ok(size) = stream.read(&mut request).await else {
                        return;
                    };
                    let request = String::from_utf8_lossy(&request[..size]);
                    let path = request
                        .split_whitespace()
                        .nth(1)
                        .unwrap_or_default()
                        .split('?')
                        .next()
                        .unwrap_or_default();
                    let relative = path.strip_prefix("/market.git/").unwrap_or_default();
                    let data = if relative.split('/').any(|part| part == "..") {
                        None
                    } else {
                        fs::read(root.join(relative)).ok()
                    };
                    let (status, body) =
                        data.map_or(("404 Not Found", Vec::new()), |body| ("200 OK", body));
                    let headers = format!("HTTP/1.1 {status}\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nConnection: close\r\n\r\n", body.len());
                    let _ = stream.write_all(headers.as_bytes()).await;
                    let _ = stream.write_all(&body).await;
                    let _ = stream.shutdown().await;
                });
            }
        });
        Self {
            directory,
            url,
            task,
        }
    }

    fn publish(&self, name: &str, version: &str) {
        self.publish_plugins(name, &[("proof", version, "Fixture skill")], None);
    }

    fn publish_plugins(&self, name: &str, plugins: &[(&str, &str, &str)], broken: Option<&str>) {
        let previous = Command::new("git")
            .arg("-C")
            .arg(self.directory.path())
            .args(["rev-parse", "--verify", "refs/heads/main"])
            .output()
            .unwrap();
        let mut stream = format!("commit refs/heads/main\ncommitter Fixture <fixture@example.invalid> 1700000000 +0000\ndata 7\nfixture\n");
        if previous.status.success() {
            stream.push_str(&format!(
                "from {}\n",
                String::from_utf8_lossy(&previous.stdout).trim()
            ));
        }
        stream.push_str("deleteall\n");
        let mut files = vec![(".agents/plugins/marketplace.json".to_string(), json!({"name":name,"plugins":plugins.iter().map(|(name, _, _)| json!({"name":name,"source":format!("./plugins/{name}")})).collect::<Vec<_>>()} ).to_string())];
        for (name, version, description) in plugins {
            files.push((format!("plugins/{name}/plugin.json"), json!({"$schema":"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json","name":name,"version":version}).to_string()));
            files.push((
                format!("plugins/{name}/skills/check/SKILL.md"),
                format!("---\nname: check\ndescription: {description}\n---\n{description}\n"),
            ));
        }
        for (path, body) in files {
            stream.push_str(&format!(
                "M 100644 inline {path}\ndata {}\n{body}\n",
                body.len()
            ));
        }
        if let Some(name) = broken {
            // Valid marketplace/manifest, but the package copy must reject this symlink.
            stream.push_str(&format!(
                "M 120000 inline plugins/{name}/unsafe-link\ndata 7\nmissing\n"
            ));
        }
        stream.push_str("\ndone\n");
        let mut child = Command::new("git")
            .arg("-C")
            .arg(self.directory.path())
            .args(["fast-import", "--quiet"])
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(stream.as_bytes())
            .unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(
            output.status.success(),
            "fixture fast-import: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        git(self.directory.path(), &["update-server-info"]);
    }
}

fn git(root: &Path, args: &[&str]) {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "fixture Git: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
