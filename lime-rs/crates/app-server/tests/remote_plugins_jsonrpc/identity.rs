use super::support::*;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;

#[tokio::test]
async fn remote_plugins_discard_inflight_directory_after_peer_logout_or_account_switch() {
    for switch in [false, true] {
        let temp = TempDir::new().unwrap();
        let first = Arc::new(server(temp.path()).await);
        let peer = server(temp.path()).await;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let (entered, request_entered) = tokio::sync::oneshot::channel();
        let (release, released) = tokio::sync::oneshot::channel();
        let http = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            receive(&mut socket).await;
            respond(&mut socket, session("old-account")).await;
            let (mut socket, _) = listener.accept().await.unwrap();
            let request = receive(&mut socket).await;
            assert!(request.contains("scope=WORKSPACE"));
            entered.send(()).unwrap();
            released.await.unwrap();
            respond(&mut socket, page(vec![item("stale", "stale-plugin")], None)).await;
        });
        rpc(&first, "account/login/start", Some(login(&url))).await;
        let querying = first.clone();
        let pending = tokio::spawn(async move { raw(&querying, "plugin/list", workspace()).await });
        tokio::time::timeout(Duration::from_secs(10), request_entered)
            .await
            .unwrap()
            .unwrap();
        if switch {
            let (url, task) = issuer(vec![ok(session("new-account"))]).await;
            rpc(&peer, "account/login/start", Some(login(&url))).await;
            finish(task).await;
        } else {
            rpc(&peer, "account/logout", None).await;
        }
        release.send(()).unwrap();
        let response = pending.await.unwrap();
        assert!(response.get("error").is_some());
        assert!(!response.to_string().contains("stale-plugin"));
        http.await.unwrap();
    }
}
