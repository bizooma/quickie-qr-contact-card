import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in every TS DOM lib).
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Live browser dictation. `onTranscript` receives the full transcript of the current session. */
export function useSpeechRecognition(onTranscript: (text: string) => void, onError: (msg: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef({ onTranscript, onError });
  cb.current = { onTranscript, onError };

  useEffect(() => {
    setSupported(!!getCtor());
    return () => rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0].transcript ?? "";
      cb.current.onTranscript(text);
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        cb.current.onError(e.error === "not-allowed" ? "Microphone access was blocked" : `Dictation stopped (${e.error})`);
      }
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, start, stop };
}
