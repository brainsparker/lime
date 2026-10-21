import {
  METHOD_ROLLOUT_COMPRESS,
  type RolloutCompressResponse,
} from "@limecloud/app-server-client";
import { AppServerClient } from "./appServer";

/** 仅确认后台任务已触发；压缩结果不通过此响应投影。 */
export async function compressRollouts(
  client: Pick<AppServerClient, "request"> = new AppServerClient(),
): Promise<void> {
  const { result } = await client.request<RolloutCompressResponse>(
    METHOD_ROLLOUT_COMPRESS,
  );
  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    Object.keys(result).length !== 0
  ) {
    throw new Error("Invalid rollout/compress acknowledgement");
  }
}
