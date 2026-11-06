/**
 * Grava em ogg/opus no navegador, o formato que o WhatsApp mostra como áudio de voz. Mesma técnica do painel
 * (`hooks/inbox/useAudioRecorder.ts`). Carrega o codificador só ao gravar, porque ele pesa.
 */
export interface OggRecording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export async function startOggRecording(): Promise<OggRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => stream.getTracks().forEach((track) => track.stop());
  try {
    const [{ default: OpusMediaRecorder }, worker, oggWasm, webmWasm] = await Promise.all([
      import("opus-media-recorder"),
      import("opus-media-recorder/encoderWorker.umd.js?url"),
      import("opus-media-recorder/OggOpusEncoder.wasm?url"),
      import("opus-media-recorder/WebMOpusEncoder.wasm?url"),
    ]);
    const recorder = new OpusMediaRecorder(
      stream,
      { mimeType: "audio/ogg" },
      {
        encoderWorkerFactory: () => new Worker(worker.default),
        OggOpusEncoderWasmPath: oggWasm.default,
        WebMOpusEncoderWasmPath: webmWasm.default,
      }
    );
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.start();
    return {
      stop: () =>
        new Promise<Blob>((resolve, reject) => {
          recorder.onerror = (event) => {
            release();
            reject(event);
          };
          recorder.onstop = () => {
            release();
            resolve(new Blob(chunks, { type: "audio/ogg" }));
          };
          recorder.stop();
        }),
      cancel: () => {
        recorder.onstop = release;
        recorder.stop();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}
