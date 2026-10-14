import { describe, expect, it } from "vitest";

import { agentEnUSResource, agentZhCNResource } from "@/i18n/agentResources";
import zhCN from "@/i18n/resources/zh-CN/agentInputbar.json";
import zhTW from "@/i18n/resources/zh-TW/agentInputbar.json";
import enUS from "@/i18n/resources/en-US/agentInputbar.json";
import jaJP from "@/i18n/resources/ja-JP/agentInputbar.json";
import koKR from "@/i18n/resources/ko-KR/agentInputbar.json";
import {
  buildInputbarCoreCopy,
  type InputbarCoreCopyKey,
} from "./inputbarCoreCopy";

function translateResource(
  resource: Partial<Record<InputbarCoreCopyKey, string>>,
  key: InputbarCoreCopyKey,
  values?: Record<string, number | string>,
) {
  return Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.split(`{{${name}}}`).join(String(value)),
    resource[key] ?? key,
  );
}

describe("inputbarCoreCopy", () => {
  it.each([
    [
      "zh-CN",
      zhCN,
      "正在连接麦克风",
      "取消语音输入",
      "语音输入已取消，请完成文字输入后重试",
    ],
    [
      "zh-TW",
      zhTW,
      "正在連接麥克風",
      "取消語音輸入",
      "語音輸入已取消，請完成文字輸入後重試",
    ],
    [
      "en-US",
      enUS,
      "Connecting microphone",
      "Cancel voice input",
      "Voice input canceled. Finish typing, then try again.",
    ],
    [
      "ja-JP",
      jaJP,
      "マイクに接続中",
      "音声入力をキャンセル",
      "音声入力をキャンセルしました。文字入力を終えてから、もう一度お試しください。",
    ],
    [
      "ko-KR",
      koKR,
      "마이크 연결 중",
      "음성 입력 취소",
      "음성 입력이 취소되었습니다. 문자 입력을 마친 후 다시 시도하세요.",
    ],
  ] as const)(
    "%s 完整提供 starting/cancel/IME 中断反馈",
    (_locale, resource, starting, cancel, interrupted) => {
      const copy = buildInputbarCoreCopy((key, values) =>
        translateResource(resource, key, values),
      );
      expect(copy.dictation.starting).toBe(starting);
      expect(copy.dictation.cancel).toBe(cancel);
      expect(copy.dictation.interruptedByComposition).toBe(interrupted);
    },
  );

  it("应构造中英文输入区 chrome 与语音文案", () => {
    const zhCopy = buildInputbarCoreCopy((key, values) =>
      translateResource(agentZhCNResource, key, values),
    );
    const enCopy = buildInputbarCoreCopy((key, values) =>
      translateResource(agentEnUSResource, key, values),
    );

    expect(zhCopy.image.add).toBe("添加图片");
    expect(zhCopy.editor.expand).toBe("展开输入框");
    expect(zhCopy.action.running).toBe("正在输出");
    expect(zhCopy.action.defer).toBe("稍后处理");
    expect(zhCopy.dictation.recording("1:05")).toBe("录音中 1:05");
    expect(zhCopy.dictation.stopRecording("录音中 1:05")).toBe(
      "录音中 1:05，点击停止",
    );

    expect(enCopy.image.add).toBe("Add image");
    expect(enCopy.editor.expand).toBe("Expand input");
    expect(enCopy.action.running).toBe("Generating");
    expect(enCopy.action.defer).toBe("Handle later");
    expect(enCopy.action.stop).toBe("Stop");
    expect(enCopy.action.send).toBe("Send");
    expect(enCopy.dictation.recording("1:05")).toBe("Recording 1:05");
    expect(enCopy.dictation.stopRecording("Recording 1:05")).toBe(
      "Recording 1:05, click to stop",
    );
  });
});
