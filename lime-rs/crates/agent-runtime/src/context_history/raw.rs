use super::{Family, Key};
use model_provider::current_client::CurrentProviderContent;
use serde_json::{json, Value};
use uuid::Uuid;

// 与 Codex 一致；改变 namespace 会改变模型可见 ID，破坏恢复与重试的缓存前缀。
const SYNTHETIC_OUTPUT_ID_NAMESPACE: Uuid = Uuid::from_u128(0x90d38d3e_6a5b_4d52_bfe2_2f1e634bfac4);

pub(super) fn call_key(item: &Value) -> Option<Key<'_>> {
    let family = match item.get("type")?.as_str()? {
        "function_call" | "local_shell_call" => Family::Function,
        "custom_tool_call" => Family::Custom,
        "tool_search_call" => Family::Search,
        _ => return None,
    };
    Some((family, item.get("call_id")?.as_str()?))
}

pub(super) fn output_key(item: &Value) -> Option<Key<'_>> {
    let family = match item.get("type")?.as_str()? {
        "function_call_output" => Family::Function,
        "custom_tool_call_output" => Family::Custom,
        "tool_search_output" => Family::Search,
        _ => return None,
    };
    Some((family, item.get("call_id")?.as_str()?))
}

pub(super) fn is_server_search_output(content: &CurrentProviderContent) -> bool {
    matches!(content, CurrentProviderContent::RawResponseItem(item)
        if item["type"] == "tool_search_output" && item["execution"] == "server")
}

pub(super) fn aborted_output(call: &Value) -> Value {
    let (family, call_id) = call_key(call).expect("only tool calls need a synthetic output");
    let (prefix, mut output) = match family {
        Family::Function => (
            "fco",
            json!({"type":"function_call_output","call_id":call_id,"output":"aborted"}),
        ),
        Family::Custom => (
            "ctco",
            json!({"type":"custom_tool_call_output","call_id":call_id,"output":"aborted"}),
        ),
        Family::Search => (
            "tso",
            json!({"type":"tool_search_output","call_id":call_id,
                "status":"completed","execution":"client","tools":[]}),
        ),
    };
    if let Some(id) = call
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
    {
        let name = format!("{prefix}:{id}");
        let id = Uuid::new_v5(&SYNTHETIC_OUTPUT_ID_NAMESPACE, name.as_bytes());
        output["id"] = json!(format!("{prefix}_{id}"));
    }
    output
}
