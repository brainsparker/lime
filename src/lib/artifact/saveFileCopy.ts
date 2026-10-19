import { copyFile } from "@/lib/api/fileBrowser";
import { save } from "@/lib/desktop-host/dialog";

/** 原生位置选择后仍验证动作 scope；文件字节复制由同一 App Server 承接。 */
export async function saveFileCopy(
  path: string,
  title: string,
  isCurrent: () => boolean,
): Promise<void> {
  const destination = await save({ title, defaultPath: path });
  if (!destination || !isCurrent() || destination === path) return;
  await copyFile(path, destination);
}
