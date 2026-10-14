import type {
  ComposerController,
  ComposerEditorHandle,
} from "@/components/input-kit";
import { applyDictationTranscript } from "./composerDictationDraft";
import {
  InputbarDictationSessionOwner,
  disposeDictationRecording,
  stopDictationStream,
  stopDictationRecording,
  type ActiveRecording,
  type DictationSession,
  type InputbarDictationState,
  type LiveAudioSampler,
} from "./inputbarDictationSession";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  polishVoiceInputText,
  transcribeVoiceInputAudio,
} from "@/lib/api/asrProvider";
import {
  buildInputbarDictationCopy,
  type InputbarDictationCopy,
} from "./inputbarDictationCopy";

interface UseInputbarDictationArgs {
  setText: (value: string) => void;
  editorRef: RefObject<ComposerEditorHandle>;
  controller: ComposerController;
  sessionId?: string | null;
  disabled: boolean;
  isComposing?: () => boolean;
}

export interface InputbarRecordingStatus {
  is_recording: boolean;
  volume: number;
  duration: number;
}

const MIN_RECORDING_DURATION_MS = 350;
const LIVE_TRANSCRIPTION_TIMESLICE_MS = 1200;
const LIVE_TRANSCRIPTION_INTERVAL_MS = 1800;
const LIVE_TRANSCRIPTION_MIN_SAMPLE_MS = 650;
const LIVE_TRANSCRIPTION_MAX_SAMPLE_MS = 1800;
const RECORDER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];
const WAV_MIME_TYPE = "audio/wav";

function getAudioContextConstructor(): typeof AudioContext | null {
  return (
    globalThis.AudioContext ??
    (
      globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext ??
    null
  );
}

function getPreferredRecorderMimeType(): string | undefined {
  const MediaRecorderCtor = globalThis.MediaRecorder;
  if (typeof MediaRecorderCtor?.isTypeSupported !== "function") {
    return undefined;
  }
  return RECORDER_MIME_TYPES.find((mimeType) =>
    MediaRecorderCtor.isTypeSupported(mimeType),
  );
}

function hasRecordingSupport(): boolean {
  return Boolean(
    typeof globalThis.navigator?.mediaDevices?.getUserMedia === "function" &&
    typeof globalThis.MediaRecorder === "function" &&
    getAudioContextConstructor(),
  );
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : String(error || "未知错误");
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(
    error.name,
  );
}

function getMicrophonePermissionMessage(copy: InputbarDictationCopy): string {
  const navigatorWithUserAgentData = globalThis.navigator as
    | (Navigator & { userAgentData?: { platform?: string } })
    | undefined;
  const platform =
    navigatorWithUserAgentData?.userAgentData?.platform ??
    navigatorWithUserAgentData?.platform ??
    "";
  if (/mac/i.test(platform)) {
    return copy.permissionDeniedMac;
  }
  if (/win/i.test(platform)) {
    return copy.permissionDeniedWindows;
  }
  return copy.permissionDeniedDefault;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

export function encodeAudioBufferToMonoPcm16WavBase64(
  audioBuffer: AudioBuffer,
): string {
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const frameCount = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const channels = Array.from({ length: channelCount }, (_, index) =>
    audioBuffer.getChannelData(index),
  );
  const samples = new Float32Array(frameCount);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    samples[frameIndex] =
      channels.reduce((sum, channel) => sum + channel[frameIndex], 0) /
      channelCount;
  }
  return encodeMonoPcmFloat32ToWavBase64(samples, sampleRate);
}

export function encodeMonoPcmFloat32ToWavBase64(
  samples: Float32Array,
  sampleRate: number,
): string {
  const frameCount = samples.length;
  const bytesPerSample = 2;
  const wavHeaderBytes = 44;
  const dataBytes = frameCount * bytesPerSample;
  const buffer = new ArrayBuffer(wavHeaderBytes + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  let writeOffset = wavHeaderBytes;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[frameIndex]));
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(writeOffset, Math.round(sample), true);
    writeOffset += bytesPerSample;
  }

  return bytesToBase64(new Uint8Array(buffer));
}

function shouldJoinWithoutSpace(left: string, right: string): boolean {
  if (!left || !right || /\s$/.test(left) || /^\s/.test(right)) {
    return true;
  }
  return (
    /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]$/u.test(left) ||
    /^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(right)
  );
}

function appendTranscriptFragment(current: string, fragment: string): string {
  const cleanFragment = fragment.trim();
  if (!cleanFragment) {
    return current;
  }
  if (!current) {
    return cleanFragment;
  }
  if (current.endsWith(cleanFragment)) {
    return current;
  }
  if (cleanFragment.startsWith(current)) {
    return cleanFragment;
  }
  const separator = shouldJoinWithoutSpace(current, cleanFragment) ? "" : " ";
  return `${current}${separator}${cleanFragment}`;
}

function createLiveAudioSampler(stream: MediaStream): LiveAudioSampler | null {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    return null;
  }
  const audioContext = new AudioContextCtor();
  if (
    typeof audioContext.createMediaStreamSource !== "function" ||
    typeof audioContext.createScriptProcessor !== "function"
  ) {
    void audioContext.close().catch(() => undefined);
    return null;
  }

  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const sampler: LiveAudioSampler = {
    audioContext,
    source,
    processor,
    sampleRate: audioContext.sampleRate,
    chunks: [],
    totalFrames: 0,
  };

  processor.onaudioprocess = (event) => {
    const inputBuffer = event.inputBuffer;
    const channelCount = Math.max(1, inputBuffer.numberOfChannels);
    const frameCount = inputBuffer.length;
    const mixed = new Float32Array(frameCount);
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = inputBuffer.getChannelData(channelIndex);
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        mixed[frameIndex] += channel[frameIndex] / channelCount;
      }
    }
    sampler.chunks.push(mixed);
    sampler.totalFrames += frameCount;
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
  void audioContext.resume?.().catch(() => undefined);
  return sampler;
}

function sliceLiveAudioSamples(
  sampler: LiveAudioSampler,
  startFrame: number,
  endFrame: number,
): Float32Array {
  const frameCount = Math.max(0, endFrame - startFrame);
  const samples = new Float32Array(frameCount);
  let chunkStart = 0;
  let writeOffset = 0;
  for (const chunk of sampler.chunks) {
    const chunkEnd = chunkStart + chunk.length;
    if (chunkEnd <= startFrame) {
      chunkStart = chunkEnd;
      continue;
    }
    if (chunkStart >= endFrame) {
      break;
    }
    const readStart = Math.max(0, startFrame - chunkStart);
    const readEnd = Math.min(chunk.length, endFrame - chunkStart);
    samples.set(chunk.subarray(readStart, readEnd), writeOffset);
    writeOffset += readEnd - readStart;
    chunkStart = chunkEnd;
  }
  return samples;
}

function collectLiveAudioSegment(activeRecording: ActiveRecording): {
  audioBase64: string;
  mimeType: string;
} | null {
  const sampler = activeRecording.sampler;
  if (!sampler) {
    return null;
  }
  const minFrames = Math.floor(
    (sampler.sampleRate * LIVE_TRANSCRIPTION_MIN_SAMPLE_MS) / 1000,
  );
  const maxFrames = Math.floor(
    (sampler.sampleRate * LIVE_TRANSCRIPTION_MAX_SAMPLE_MS) / 1000,
  );
  const availableFrames =
    sampler.totalFrames - activeRecording.liveSampleCursor;
  if (availableFrames < minFrames) {
    return null;
  }
  const endFrame = sampler.totalFrames;
  const startFrame = Math.max(
    activeRecording.liveSampleCursor,
    endFrame - maxFrames,
  );
  activeRecording.liveSampleCursor = endFrame;
  const samples = sliceLiveAudioSamples(sampler, startFrame, endFrame);
  if (samples.length === 0) {
    return null;
  }
  return {
    audioBase64: encodeMonoPcmFloat32ToWavBase64(samples, sampler.sampleRate),
    mimeType: WAV_MIME_TYPE,
  };
}

export function useInputbarDictation({
  setText,
  editorRef,
  controller,
  sessionId = null,
  disabled,
  isComposing,
}: UseInputbarDictationArgs) {
  const { t } = useTranslation("agent");
  const copy = useMemo(() => buildInputbarDictationCopy((key) => t(key)), [t]);
  const [sessionOwner] = useState(() => new InputbarDictationSessionOwner());
  const [dictationState, setDictationState] =
    useState<InputbarDictationState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const compositionRef = useRef(isComposing);
  compositionRef.current = isComposing;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const livePreviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const clearRecordingTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (livePreviewTimerRef.current) clearInterval(livePreviewTimerRef.current);
    timerRef.current = null;
    livePreviewTimerRef.current = null;
  }, []);

  const resetStatus = useCallback(() => {
    clearRecordingTimer();
    setDictationState("idle");
    setRecordingDuration(0);
    setLiveTranscript("");
  }, [clearRecordingTimer]);

  useEffect(() => {
    resetStatus();
    return () => {
      sessionOwner.dispose();
      clearRecordingTimer();
    };
  }, [controller, sessionId, sessionOwner, resetStatus, clearRecordingTimer]);

  const ownsSession = useCallback(
    (session: DictationSession) =>
      sessionOwner.owns(session, controllerRef.current, sessionIdRef.current),
    [sessionOwner],
  );

  const finishSession = useCallback(
    (session: DictationSession) => {
      if (sessionOwner.finish(session)) resetStatus();
    },
    [resetStatus, sessionOwner],
  );

  const composing = useCallback(
    () =>
      compositionRef.current?.() ?? editorRef.current?.isComposing() ?? false,
    [editorRef],
  );

  const applyTranscript = useCallback(
    (session: DictationSession, text: string, final: boolean): boolean => {
      if (!ownsSession(session)) return false;
      if (composing()) {
        finishSession(session);
        return false;
      }
      if (!applyDictationTranscript(session.owner, session.draft, text))
        return false;
      session.applied = true;
      setText(session.owner.getDocument().text);
      if (final) editorRef.current?.focus();
      return true;
    },
    [composing, editorRef, finishSession, ownsSession, setText],
  );

  const handleDictationCancel = useCallback(() => {
    if (
      controller !== controllerRef.current ||
      sessionId !== sessionIdRef.current
    )
      return;
    const previous = controller.getSnapshot();
    if (!sessionOwner.cancel(controller, sessionId)) return;
    resetStatus();
    if (controller.getSnapshot() !== previous)
      setText(controller.getDocument().text);
  }, [controller, resetStatus, sessionId, sessionOwner, setText]);

  const discardDictationSession = useCallback((): boolean => {
    if (
      controller !== controllerRef.current ||
      sessionId !== sessionIdRef.current
    )
      return false;
    if (!sessionOwner.discard(controller, sessionId)) return false;
    resetStatus();
    return true;
  }, [controller, resetStatus, sessionId, sessionOwner]);

  const transcribeBlob = useCallback(
    async (blob: Blob, session: DictationSession) => {
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) throw new Error(copy.unavailable);
      const audioContext = new AudioContextCtor();
      session.decodingContexts.add(audioContext);
      try {
        const encodedAudio = await blob.arrayBuffer();
        if (!ownsSession(session)) return null;
        const audioBuffer = await audioContext.decodeAudioData(
          encodedAudio.slice(0),
        );
        if (!ownsSession(session)) return null;
        return transcribeVoiceInputAudio({
          audioBase64: encodeAudioBufferToMonoPcm16WavBase64(audioBuffer),
          mimeType: WAV_MIME_TYPE,
        });
      } finally {
        if (session.decodingContexts.delete(audioContext)) {
          await audioContext.close().catch(() => undefined);
        }
      }
    },
    [copy.unavailable, ownsSession],
  );

  const updateLiveTranscript = useCallback(
    async (session: DictationSession) => {
      const activeRecording = session.recording;
      if (
        !ownsSession(session) ||
        !activeRecording ||
        activeRecording.finalizing ||
        activeRecording.livePreviewInFlight
      )
        return;
      const liveSegment = collectLiveAudioSegment(activeRecording);
      if (
        !liveSegment &&
        (activeRecording.chunks.length === 0 ||
          activeRecording.chunks.length ===
            activeRecording.lastLivePreviewChunkCount)
      )
        return;
      activeRecording.livePreviewInFlight = true;
      activeRecording.lastLivePreviewChunkCount = activeRecording.chunks.length;
      const sequence = ++activeRecording.livePreviewSequence;
      try {
        const result = liveSegment
          ? await transcribeVoiceInputAudio(liveSegment)
          : await transcribeBlob(
              new Blob(activeRecording.chunks, {
                type:
                  activeRecording.recorder.mimeType || activeRecording.mimeType,
              }),
              session,
            );
        if (
          !result ||
          !ownsSession(session) ||
          activeRecording.finalizing ||
          session.recording !== activeRecording ||
          sequence !== activeRecording.livePreviewSequence
        )
          return;
        const text = liveSegment
          ? appendTranscriptFragment(
              activeRecording.liveTranscriptText,
              result.text,
            )
          : result.text.trim();
        if (!text) return;
        activeRecording.liveTranscriptText = text;
        setLiveTranscript(text);
        applyTranscript(session, text, false);
      } catch (error) {
        if (ownsSession(session))
          console.warn(
            "[voice-input] live transcription preview failed",
            error,
          );
      } finally {
        if (ownsSession(session) && session.recording === activeRecording)
          activeRecording.livePreviewInFlight = false;
      }
    },
    [applyTranscript, ownsSession, transcribeBlob],
  );

  const finishRecording = useCallback(
    async (session: DictationSession) => {
      const activeRecording = session.recording;
      if (
        !ownsSession(session) ||
        session.phase !== "listening" ||
        !activeRecording
      )
        return;
      session.phase = "transcribing";
      activeRecording.finalizing = true;
      setDictationState("transcribing");
      clearRecordingTimer();
      const elapsedMs = performance.now() - activeRecording.startedAt;
      try {
        const blob = await stopDictationRecording(
          session,
          copy.recognitionFailed,
        );
        if (!ownsSession(session)) return;
        disposeDictationRecording(session);
        if (elapsedMs < MIN_RECORDING_DURATION_MS || blob.size === 0) {
          toast.error(copy.tooShort);
          return;
        }
        const result = await transcribeBlob(blob, session);
        if (!result || !ownsSession(session)) return;
        const rawTranscript = result.text.trim();
        if (!rawTranscript) {
          toast.error(copy.emptyTranscript);
          return;
        }
        setLiveTranscript(rawTranscript);
        let transcript = rawTranscript;
        try {
          const polished = await polishVoiceInputText({ text: rawTranscript });
          transcript = polished.text.trim() || rawTranscript;
        } catch (error) {
          if (ownsSession(session))
            console.warn(
              "[voice-input] polish failed, using raw transcript",
              error,
            );
        }
        if (!ownsSession(session)) return;
        applyTranscript(session, transcript, true);
      } catch (error) {
        if (ownsSession(session))
          toast.error(`${copy.recognitionFailed}: ${describeError(error)}`);
      } finally {
        if (ownsSession(session)) finishSession(session);
      }
    },
    [
      applyTranscript,
      clearRecordingTimer,
      copy,
      finishSession,
      ownsSession,
      transcribeBlob,
    ],
  );

  const startRecording = useCallback(async () => {
    if (
      controller !== controllerRef.current ||
      sessionId !== sessionIdRef.current ||
      composing()
    )
      return;
    if (!hasRecordingSupport()) {
      toast.error(copy.unavailable);
      return;
    }
    const session = sessionOwner.start(controller, sessionId);
    if (!session) return;
    setDictationState("starting");
    setRecordingDuration(0);
    setLiveTranscript("");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!ownsSession(session)) {
        stopDictationStream(stream);
        return;
      }
      const mimeType = getPreferredRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const activeRecording: ActiveRecording = {
        stream,
        recorder,
        chunks: [],
        startedAt: performance.now(),
        mimeType: recorder.mimeType || mimeType || "",
        finalizing: false,
        livePreviewInFlight: false,
        livePreviewSequence: 0,
        lastLivePreviewChunkCount: 0,
        liveTranscriptText: "",
        liveSampleCursor: 0,
        sampler: createLiveAudioSampler(stream),
        onData: (event) => {
          if (!ownsSession(session) || event.data.size === 0) return;
          activeRecording.chunks.push(event.data);
          void updateLiveTranscript(session);
        },
      };
      session.recording = activeRecording;
      recorder.addEventListener("dataavailable", activeRecording.onData);
      recorder.start(LIVE_TRANSCRIPTION_TIMESLICE_MS);
      session.phase = "listening";
      setDictationState("listening");
      timerRef.current = setInterval(() => {
        if (ownsSession(session))
          setRecordingDuration(
            Math.max(0, (performance.now() - activeRecording.startedAt) / 1000),
          );
      }, 250);
      livePreviewTimerRef.current = setInterval(() => {
        if (!ownsSession(session)) return;
        if (recorder.state === "recording") recorder.requestData?.();
        void updateLiveTranscript(session);
      }, LIVE_TRANSCRIPTION_INTERVAL_MS);
    } catch (error) {
      if (stream && !session.recording) stopDictationStream(stream);
      if (!ownsSession(session)) return;
      finishSession(session);
      toast.error(
        isPermissionDeniedError(error)
          ? getMicrophonePermissionMessage(copy)
          : `${copy.startFailed}: ${describeError(error)}`,
      );
    }
  }, [
    controller,
    composing,
    copy,
    finishSession,
    ownsSession,
    sessionOwner,
    sessionId,
    updateLiveTranscript,
  ]);

  const handleDictationToggle = useCallback(async () => {
    if (
      disabled ||
      controller !== controllerRef.current ||
      sessionId !== sessionIdRef.current
    )
      return;
    const session = sessionOwner.getCurrent();
    if (session) {
      if (session.phase === "listening") await finishRecording(session);
      return;
    }
    await startRecording();
  }, [
    controller,
    disabled,
    finishRecording,
    sessionId,
    sessionOwner,
    startRecording,
  ]);

  const recordingStatus: InputbarRecordingStatus | null =
    dictationState === "idle"
      ? null
      : {
          is_recording: dictationState === "listening",
          volume: 0,
          duration: recordingDuration,
        };
  return {
    dictationEnabled: true,
    voiceConfigLoaded: true,
    dictationState,
    recordingStatus,
    liveTranscript,
    isDictating: dictationState === "listening",
    isDictationStarting: dictationState === "starting",
    isDictationBusy: dictationState !== "idle",
    isDictationProcessing: dictationState === "transcribing",
    handleDictationToggle,
    handleDictationCancel,
    discardDictationSession,
  };
}
