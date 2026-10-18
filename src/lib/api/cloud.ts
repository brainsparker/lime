import { AppServerClient } from "./appServer";
import type {
  AppServerCloudRequestParams,
  AppServerCloudRequestResponse,
} from "./appServerTypes";

export async function requestCloud(
  params: AppServerCloudRequestParams,
  client: Pick<AppServerClient, "requestCloud"> = new AppServerClient(),
): Promise<AppServerCloudRequestResponse> {
  return (await client.requestCloud(params)).result;
}
