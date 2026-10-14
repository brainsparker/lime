import type { ComposerController } from "@/components/input-kit";
import type { ComposerDraftSnapshot } from "@/components/input-kit/types";
import {
  captureDictationDraft,
  type DictationDraft,
} from "./composerDictationDraft";

export type InputbarDictationState =
  | "idle"
  | "starting"
  | "listening"
  | "transcribing";

export interface LiveAudioSampler {
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  sampleRate: number;
  chunks: Float32Array[];
  totalFrames: number;
}

export interface ActiveRecording {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  mimeType: string;
  finalizing: boolean;
  livePreviewInFlight: boolean;
  livePreviewSequence: number;
  lastLivePreviewChunkCount: number;
  liveTranscriptText: string;
  liveSampleCursor: number;
  sampler: LiveAudioSampler | null;
  onData: (event: BlobEvent) => void;
}

export interface DictationSession {
  readonly generation: number;
  readonly owner: ComposerController;
  readonly sessionId: string | null;
  readonly originalDraft: ComposerDraftSnapshot;
  readonly draft: DictationDraft;
  phase: Exclude<InputbarDictationState, "idle">;
  recording: ActiveRecording | null;
  decodingContexts: Set<AudioContext>;
  applied: boolean;
}

export function stopDictationStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export function stopDictationSampler(sampler: LiveAudioSampler | null): void {
  if (!sampler) return;
  sampler.processor.onaudioprocess = null;
  sampler.processor.disconnect();
  sampler.source.disconnect();
  void sampler.audioContext.close().catch(() => undefined);
}

export function disposeDictationRecording(session: DictationSession): void {
  const recording = session.recording;
  session.recording = null;
  if (!recording) return;
  recording.recorder.removeEventListener("dataavailable", recording.onData);
  stopDictationSampler(recording.sampler);
  stopDictationStream(recording.stream);
  if (recording.recorder.state !== "inactive") {
    try {
      recording.recorder.stop();
    } catch {
      /* The session is already invalidated. */
    }
  }
}

export function stopDictationRecording(
  session: DictationSession,
  recognitionFailed: string,
): Promise<Blob> {
  const activeRecording = session.recording;
  if (!activeRecording)
    return Promise.resolve(new Blob([], { type: "audio/wav" }));
  const { recorder, chunks, mimeType } = activeRecording;
  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      recorder.removeEventListener("stop", handleStop);
      recorder.removeEventListener("error", handleError);
    };
    const handleStop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };
    const handleError = (event: Event) => {
      cleanup();
      reject(
        event instanceof ErrorEvent
          ? event.error || new Error(event.message)
          : new Error(recognitionFailed),
      );
    };
    recorder.addEventListener("stop", handleStop, { once: true });
    recorder.addEventListener("error", handleError, { once: true });
    try {
      recorder.requestData?.();
      if (recorder.state === "inactive") {
        handleStop();
        return;
      }
      recorder.stop();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

// One synchronous owner survives React renders and asynchronous permission/RPC waits.
export class InputbarDictationSessionOwner {
  private generation = 0;
  private current: DictationSession | null = null;

  getCurrent(): DictationSession | null {
    return this.current;
  }

  start(
    owner: ComposerController,
    sessionId: string | null,
  ): DictationSession | null {
    if (this.current) return null;
    const session: DictationSession = {
      generation: ++this.generation,
      owner,
      sessionId,
      originalDraft: owner.captureDraft(),
      draft: captureDictationDraft(owner),
      phase: "starting",
      recording: null,
      decodingContexts: new Set(),
      applied: false,
    };
    this.current = session;
    return session;
  }

  owns(
    session: DictationSession,
    owner: ComposerController,
    sessionId: string | null,
  ): boolean {
    return (
      this.current === session &&
      session.generation === this.generation &&
      session.owner === owner &&
      session.sessionId === sessionId
    );
  }

  finish(session: DictationSession): boolean {
    if (this.current !== session) return false;
    this.current = null;
    this.generation += 1;
    disposeDictationRecording(session);
    for (const context of session.decodingContexts) {
      void context.close().catch(() => undefined);
    }
    session.decodingContexts.clear();
    return true;
  }

  cancel(owner: ComposerController, sessionId: string | null): boolean {
    const session = this.current;
    if (!session || !this.owns(session, owner, sessionId)) return false;
    // Restore only our own provisional edit. A later edit/resource/owner is preserved.
    const restore =
      session.applied &&
      owner.getSnapshot().revision === session.draft.revision;
    this.finish(session);
    if (restore) owner.restoreDraft(session.originalDraft);
    return true;
  }

  discard(owner: ComposerController, sessionId: string | null): boolean {
    const session = this.current;
    return session && this.owns(session, owner, sessionId)
      ? this.finish(session)
      : false;
  }

  dispose(): void {
    if (this.current) this.finish(this.current);
  }
}
