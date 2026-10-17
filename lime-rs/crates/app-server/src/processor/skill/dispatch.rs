use super::{JsonRpcError, RequestProcessor, RpcDispatch};
use app_server_protocol::*;
use futures::{future::BoxFuture, FutureExt};

impl RequestProcessor {
    pub(in crate::processor) fn dispatch_skill_request<'a>(
        &'a self,
        method: &str,
        params: &mut Option<serde_json::Value>,
    ) -> Option<BoxFuture<'a, Result<RpcDispatch, JsonRpcError>>> {
        let request = match method {
            METHOD_SKILL_READ => self.handle_skill_read_impl(params.take()).boxed(),
            METHOD_SKILL_MANAGEMENT_LIST => self
                .handle_skill_management_list_impl(params.take())
                .boxed(),
            METHOD_SKILL_MANAGEMENT_INSTALL => self
                .handle_skill_management_install_impl(params.take())
                .boxed(),
            METHOD_SKILL_MANAGEMENT_UNINSTALL => self
                .handle_skill_management_uninstall_impl(params.take())
                .boxed(),
            METHOD_SKILL_REPOSITORY_LIST => self.handle_skill_repository_list_impl().boxed(),
            METHOD_SKILL_REPOSITORY_SAVE => self
                .handle_skill_repository_save_impl(params.take())
                .boxed(),
            METHOD_SKILL_REPOSITORY_DELETE => self
                .handle_skill_repository_delete_impl(params.take())
                .boxed(),
            METHOD_SKILL_CACHE_REFRESH => self.handle_skill_cache_refresh_impl().boxed(),
            METHOD_SKILL_INSTALLED_DIRECTORIES_LIST => {
                self.handle_skill_installed_directories_list_impl().boxed()
            }
            METHOD_SKILL_LOCAL_INSPECT => {
                self.handle_skill_local_inspect_impl(params.take()).boxed()
            }
            METHOD_SKILL_LOCAL_DETAIL_INSPECT => self
                .handle_skill_local_detail_inspect_impl(params.take())
                .boxed(),
            METHOD_SKILL_LOCAL_SCAFFOLD_CREATE => self
                .handle_skill_local_scaffold_create_impl(params.take())
                .boxed(),
            METHOD_SKILL_LOCAL_IMPORT => self.handle_skill_local_import_impl(params.take()).boxed(),
            METHOD_SKILL_LOCAL_RENAME => self.handle_skill_local_rename_impl(params.take()).boxed(),
            METHOD_SKILL_REMOTE_INSPECT => {
                self.handle_skill_remote_inspect_impl(params.take()).boxed()
            }
            METHOD_SKILL_PACKAGE_LOCAL_INSPECT => self
                .handle_skill_package_local_inspect_impl(params.take())
                .boxed(),
            METHOD_SKILL_PACKAGE_LOCAL_INSTALL => self
                .handle_skill_package_local_install_impl(params.take())
                .boxed(),
            METHOD_SKILL_PACKAGE_LOCAL_REPLACE => self
                .handle_skill_package_local_replace_impl(params.take())
                .boxed(),
            METHOD_SKILL_PACKAGE_EXPORT => {
                self.handle_skill_package_export_impl(params.take()).boxed()
            }
            METHOD_SKILL_MARKETPLACE_INSTALL => self
                .handle_skill_marketplace_install_impl(params.take())
                .boxed(),
            METHOD_SKILL_PACKAGE_DOWNLOAD_INSTALL => self
                .handle_skill_download_install_impl(params.take())
                .boxed(),
            METHOD_WORKSPACE_SKILL_BINDINGS_LIST => self
                .handle_workspace_skill_bindings_list_impl(params.take())
                .boxed(),
            METHOD_WORKSPACE_REGISTERED_SKILLS_LIST => self
                .handle_workspace_registered_skills_list_impl(params.take())
                .boxed(),
            app_server_protocol::protocol::v2::METHOD_SKILLS_LIST => {
                self.handle_skills_list_v2_impl(params.take()).boxed()
            }
            app_server_protocol::protocol::v2::METHOD_SKILLS_EXTRA_ROOTS_SET => self
                .handle_skills_extra_roots_set_v2_impl(params.take())
                .boxed(),
            app_server_protocol::protocol::v2::METHOD_SKILLS_CONFIG_WRITE => self
                .handle_skills_config_write_v2_impl(params.take())
                .boxed(),
            _ => return None,
        };
        Some(request)
    }
}
