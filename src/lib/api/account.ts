import { AppServerClient } from "./appServer";
import type {
  AppServerGetAccountParams,
  AppServerGetAccountResponse,
  AppServerLoginAccountParams,
  AppServerLoginAccountResponse,
  AppServerLogoutAccountResponse,
} from "./appServerTypes";

export type AccountClient = Pick<
  AppServerClient,
  "loginAccount" | "readAccount" | "logoutAccount"
>;

export async function loginAccount(
  params: AppServerLoginAccountParams,
  client: AccountClient = new AppServerClient(),
): Promise<AppServerLoginAccountResponse> {
  return (await client.loginAccount(params)).result;
}

export async function readAccount(
  params: AppServerGetAccountParams = {},
  client: AccountClient = new AppServerClient(),
): Promise<AppServerGetAccountResponse> {
  return (await client.readAccount(params)).result;
}

export async function logoutAccount(
  client: AccountClient = new AppServerClient(),
): Promise<AppServerLogoutAccountResponse> {
  return (await client.logoutAccount()).result;
}
