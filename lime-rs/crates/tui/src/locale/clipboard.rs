use super::Locale;

impl Locale {
    pub(crate) fn copy_picker_title(self) -> &'static str {
        match self {
            Self::ZhCn => "复制到剪贴板",
            Self::ZhTw => "複製到剪貼簿",
            Self::EnUs => "Copy to clipboard",
            Self::JaJp => "クリップボードにコピー",
            Self::KoKr => "클립보드에 복사",
        }
    }

    pub(crate) fn copy_whole_status_label(self) -> &'static str {
        match self {
            Self::ZhCn => "完整状态",
            Self::ZhTw => "完整狀態",
            Self::EnUs => "Whole status",
            Self::JaJp => "ステータス全体",
            Self::KoKr => "전체 상태",
        }
    }

    pub(crate) fn copy_model_label(self) -> &'static str {
        match self {
            Self::EnUs => "Model",
            _ => self.model_label(),
        }
    }

    pub(crate) fn copy_directory_label(self) -> &'static str {
        match self {
            Self::EnUs => "Directory",
            _ => self.cwd_label(),
        }
    }

    pub(crate) fn thread_name_label(self) -> &'static str {
        match self {
            Self::ZhCn => "会话名称",
            Self::ZhTw => "工作階段名稱",
            Self::EnUs => "Thread name",
            Self::JaJp => "スレッド名",
            Self::KoKr => "스레드 이름",
        }
    }

    pub(crate) fn copy_session_id_label(self) -> &'static str {
        match self {
            Self::ZhCn => "会话 ID",
            Self::ZhTw => "工作階段 ID",
            Self::EnUs => "Session ID",
            Self::JaJp => "セッション ID",
            Self::KoKr => "세션 ID",
        }
    }

    pub(crate) fn transcript_nothing_to_copy(self) -> &'static str {
        match self {
            Self::ZhCn => "没有可复制的内容",
            Self::ZhTw => "沒有可複製的內容",
            Self::EnUs => "Nothing to copy",
            Self::JaJp => "コピーする内容がありません",
            Self::KoKr => "복사할 내용이 없습니다",
        }
    }

    pub(crate) fn transcript_copy_mode_title(
        self,
        kind: crate::transcript_view::CopyTargetKind,
    ) -> String {
        use crate::transcript_view::CopyTargetKind;
        let label = match (self, kind) {
            (Self::ZhCn, CopyTargetKind::WholeResponse) => "完整回复",
            (Self::ZhTw, CopyTargetKind::WholeResponse) => "完整回覆",
            (Self::EnUs, CopyTargetKind::WholeResponse) => "Whole response",
            (Self::JaJp, CopyTargetKind::WholeResponse) => "応答全体",
            (Self::KoKr, CopyTargetKind::WholeResponse) => "전체 응답",
            (Self::ZhCn, CopyTargetKind::UserMessage) => "用户消息",
            (Self::ZhTw, CopyTargetKind::UserMessage) => "使用者訊息",
            (Self::EnUs, CopyTargetKind::UserMessage) => "User message",
            (Self::JaJp, CopyTargetKind::UserMessage) => "ユーザーメッセージ",
            (Self::KoKr, CopyTargetKind::UserMessage) => "사용자 메시지",
            (Self::ZhCn, CopyTargetKind::CodeBlock) => "代码块",
            (Self::ZhTw, CopyTargetKind::CodeBlock) => "程式碼區塊",
            (Self::EnUs, CopyTargetKind::CodeBlock) => "Code block",
            (Self::JaJp, CopyTargetKind::CodeBlock) => "コードブロック",
            (Self::KoKr, CopyTargetKind::CodeBlock) => "코드 블록",
            (Self::ZhCn, CopyTargetKind::Blockquote) => "引用块",
            (Self::ZhTw, CopyTargetKind::Blockquote) => "引用區塊",
            (Self::EnUs, CopyTargetKind::Blockquote) => "Blockquote",
            (Self::JaJp, CopyTargetKind::Blockquote) => "引用ブロック",
            (Self::KoKr, CopyTargetKind::Blockquote) => "인용 블록",
        };
        match self {
            Self::ZhCn => format!("复制{label}"),
            Self::ZhTw => format!("複製{label}"),
            Self::EnUs => format!("Copy {}", label.to_ascii_lowercase()),
            Self::JaJp => format!("{label}をコピー"),
            Self::KoKr => format!("{label} 복사"),
        }
    }

    pub(crate) fn transcript_copy_mode_navigation(self) -> &'static str {
        match self {
            Self::ZhCn => "↑/↓/j/k 选择 · g/G 首尾 · enter 复制 · esc 关闭",
            Self::ZhTw => "↑/↓/j/k 選擇 · g/G 首尾 · enter 複製 · esc 關閉",
            Self::EnUs => "↑/↓/j/k select · g/G ends · enter copy · esc close",
            Self::JaJp => "↑/↓/j/k 選択 · g/G 最初/最後 · enter コピー · esc 閉じる",
            Self::KoKr => "↑/↓/j/k 선택 · g/G 처음/끝 · enter 복사 · esc 닫기",
        }
    }

    pub(crate) fn copy_status(
        self,
        status: crate::clipboard_copy::CopyStatus,
        label: &str,
    ) -> String {
        use crate::clipboard_copy::CopyStatus;
        if self == Self::EnUs {
            return status.message(label);
        }
        let label = match (self, label) {
            (Self::ZhCn, "last response") => "最近回复",
            (Self::ZhTw, "last response") => "最近回覆",
            (Self::JaJp, "last response") => "直前の応答",
            (Self::KoKr, "last response") => "마지막 응답",
            (Self::ZhCn, "selected text") => "选中文本",
            (Self::ZhTw, "selected text") => "選取文字",
            (Self::JaJp, "selected text") => "選択したテキスト",
            (Self::KoKr, "selected text") => "선택한 텍스트",
            (Self::ZhCn, "chat") => "对话",
            (Self::ZhTw, "chat") => "對話",
            (Self::JaJp, "chat") => "会話",
            (Self::KoKr, "chat") => "대화",
            _ => label,
        };
        match status {
            CopyStatus::Confirmed => match self {
                Self::ZhCn => format!("已将{label}复制到剪贴板"),
                Self::ZhTw => format!("已將{label}複製到剪貼簿"),
                Self::JaJp => format!("{label}をクリップボードにコピーしました"),
                Self::KoKr => format!("{label} 클립보드에 복사함"),
                Self::EnUs => status.message(label),
            },
            CopyStatus::Unconfirmed => match self {
                Self::ZhCn => "复制未确认；可用 /export 保存对话".into(),
                Self::ZhTw => "複製未確認；可用 /export 儲存對話".into(),
                Self::JaJp => "コピーは未確認です。/export で会話を保存できます".into(),
                Self::KoKr => "복사 확인 안 됨; /export로 대화를 저장할 수 있습니다".into(),
                Self::EnUs => status.message(label),
            },
            CopyStatus::Pending(_) => match self {
                Self::ZhCn => format!("正在复制{label}…"),
                Self::ZhTw => format!("正在複製{label}…"),
                Self::JaJp => format!("{label}をコピー中…"),
                Self::KoKr => format!("{label} 복사 중…"),
                Self::EnUs => status.message(label),
            },
            CopyStatus::Busy => match self {
                Self::ZhCn => "已有复制正在进行".into(),
                Self::ZhTw => "已有複製正在進行".into(),
                Self::JaJp => "コピーはすでに進行中です".into(),
                Self::KoKr => "복사가 이미 진행 중입니다".into(),
                Self::EnUs => status.message(label),
            },
        }
    }

    pub(crate) fn clipboard_paste_failure(self, error: &str) -> String {
        let detail = match error {
            "clipboard read timed out" => match self {
                Self::ZhCn => "读取剪贴板超时",
                Self::ZhTw => "讀取剪貼簿逾時",
                Self::EnUs => error,
                Self::JaJp => "クリップボードの読み取りがタイムアウトしました",
                Self::KoKr => "클립보드 읽기 시간이 초과되었습니다",
            },
            "clipboard text exceeds the message size limit" => match self {
                Self::ZhCn => "剪贴板内容超过消息字符上限",
                Self::ZhTw => "剪貼簿內容超過訊息字元上限",
                Self::EnUs => error,
                Self::JaJp => "クリップボードの内容がメッセージの文字数上限を超えています",
                Self::KoKr => "클립보드 내용이 메시지 글자 수 제한을 초과했습니다",
            },
            "clipboard text is unavailable" => match self {
                Self::ZhCn => "无法读取剪贴板文本",
                Self::ZhTw => "無法讀取剪貼簿文字",
                Self::EnUs => error,
                Self::JaJp => "クリップボードのテキストを読み取れません",
                Self::KoKr => "클립보드 텍스트를 읽을 수 없습니다",
            },
            "clipboard text is unavailable over SSH" => match self {
                Self::ZhCn => "SSH 会话无法读取本地剪贴板文本",
                Self::ZhTw => "SSH 工作階段無法讀取本機剪貼簿文字",
                Self::EnUs => error,
                Self::JaJp => "SSH セッションではローカルのクリップボードを読み取れません",
                Self::KoKr => "SSH 세션에서는 로컬 클립보드 텍스트를 읽을 수 없습니다",
            },
            "X11 primary selection is unavailable in this terminal" => match self {
                Self::ZhCn => "当前终端无法读取 X11 主选区",
                Self::ZhTw => "目前終端無法讀取 X11 主選區",
                Self::EnUs => error,
                Self::JaJp => "このターミナルでは X11 のプライマリ選択を読み取れません",
                Self::KoKr => "현재 터미널에서는 X11 기본 선택 영역을 읽을 수 없습니다",
            },
            "Windows clipboard reader is unavailable"
            | "could not start Windows clipboard reader"
            | "could not start clipboard reader" => match self {
                Self::ZhCn => "无法启动 Windows 剪贴板读取程序",
                Self::ZhTw => "無法啟動 Windows 剪貼簿讀取程式",
                Self::EnUs => error,
                Self::JaJp => "Windows のクリップボード読み取りプログラムを起動できません",
                Self::KoKr => "Windows 클립보드 읽기 프로그램을 시작할 수 없습니다",
            },
            "clipboard reader has no output"
            | "could not read clipboard text"
            | "clipboard reader failed" => match self {
                Self::ZhCn => "剪贴板读取程序未能返回文本",
                Self::ZhTw => "剪貼簿讀取程式未能傳回文字",
                Self::EnUs => error,
                Self::JaJp => "クリップボードの読み取りプログラムからテキストを取得できません",
                Self::KoKr => "클립보드 읽기 프로그램에서 텍스트를 가져올 수 없습니다",
            },
            "clipboard text is not UTF-8" => match self {
                Self::ZhCn => "剪贴板文本不是有效的 UTF-8",
                Self::ZhTw => "剪貼簿文字不是有效的 UTF-8",
                Self::EnUs => error,
                Self::JaJp => "クリップボードのテキストが有効な UTF-8 ではありません",
                Self::KoKr => "클립보드 텍스트가 올바른 UTF-8이 아닙니다",
            },
            _ => error,
        };
        self.status(&format!("clipboard paste failed: {detail}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_progress_and_delivery_messages_cover_every_product_locale() {
        use crate::clipboard_copy::CopyStatus;
        for (locale, confirmed, unconfirmed, pending, busy) in [
            (
                Locale::ZhCn,
                "已将选中文本复制到剪贴板",
                "复制未确认；可用 /export 保存对话",
                "正在复制选中文本…",
                "已有复制正在进行",
            ),
            (
                Locale::ZhTw,
                "已將選取文字複製到剪貼簿",
                "複製未確認；可用 /export 儲存對話",
                "正在複製選取文字…",
                "已有複製正在進行",
            ),
            (
                Locale::EnUs,
                "Copied selected text to clipboard",
                "Copy unconfirmed; /export saves chat",
                "Copying selected text…",
                "Copy already in progress",
            ),
            (
                Locale::JaJp,
                "選択したテキストをクリップボードにコピーしました",
                "コピーは未確認です。/export で会話を保存できます",
                "選択したテキストをコピー中…",
                "コピーはすでに進行中です",
            ),
            (
                Locale::KoKr,
                "선택한 텍스트 클립보드에 복사함",
                "복사 확인 안 됨; /export로 대화를 저장할 수 있습니다",
                "선택한 텍스트 복사 중…",
                "복사가 이미 진행 중입니다",
            ),
        ] {
            for (status, expected) in [
                (CopyStatus::Confirmed, confirmed),
                (CopyStatus::Unconfirmed, unconfirmed),
                (CopyStatus::Pending(7), pending),
                (CopyStatus::Busy, busy),
            ] {
                assert_eq!(
                    locale.copy_status(status, "selected text"),
                    expected,
                    "{locale:?} {status:?}"
                );
            }
            assert_ne!(
                locale.copy_status(CopyStatus::Pending(7), "last response"),
                pending
            );
            assert_ne!(locale.copy_status(CopyStatus::Pending(7), "chat"), pending);
        }
    }

    #[test]
    fn size_and_timeout_errors_are_localized_for_all_product_locales() {
        for (locale, size, timeout) in [
            (Locale::ZhCn, "粘贴剪贴板内容失败: 剪贴板内容超过消息字符上限", "粘贴剪贴板内容失败: 读取剪贴板超时"),
            (Locale::ZhTw, "貼上剪貼簿內容失敗: 剪貼簿內容超過訊息字元上限", "貼上剪貼簿內容失敗: 讀取剪貼簿逾時"),
            (Locale::EnUs, "clipboard paste failed: clipboard text exceeds the message size limit", "clipboard paste failed: clipboard read timed out"),
            (Locale::JaJp, "クリップボードの貼り付けに失敗しました: クリップボードの内容がメッセージの文字数上限を超えています", "クリップボードの貼り付けに失敗しました: クリップボードの読み取りがタイムアウトしました"),
            (Locale::KoKr, "클립보드 붙여넣기 실패: 클립보드 내용이 메시지 글자 수 제한을 초과했습니다", "클립보드 붙여넣기 실패: 클립보드 읽기 시간이 초과되었습니다"),
        ] {
            assert_eq!(locale.clipboard_paste_failure("clipboard text exceeds the message size limit"), size);
            assert_eq!(locale.clipboard_paste_failure("clipboard read timed out"), timeout);
        }
    }

    #[test]
    fn unknown_platform_diagnostic_is_preserved() {
        assert_eq!(
            Locale::ZhCn.clipboard_paste_failure("native broker error 42"),
            "粘贴剪贴板内容失败: native broker error 42"
        );
    }
}
