declare module "opus-media-recorder" {
  interface WorkerOptions {
    encoderWorkerFactory: () => Worker;
    OggOpusEncoderWasmPath: string;
    WebMOpusEncoderWasmPath: string;
  }
  export default class OpusMediaRecorder extends EventTarget {
    constructor(stream: MediaStream, options: { mimeType: string }, workerOptions: WorkerOptions);
    state: "inactive" | "recording" | "paused";
    ondataavailable: ((event: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
    onerror: ((event: unknown) => void) | null;
    start(timeslice?: number): void;
    stop(): void;
  }
}
