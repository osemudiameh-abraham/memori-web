"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

type UseDeepgramSTTOptions = {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

type UseDeepgramSTTReturn = {
  voiceState: VoiceState;
  start: () => void;
  stop: () => void;
  isActive: boolean;
  errorMessage: string | null;
  analyserNode: AnalyserNode | null;
  speakText: (text: string) => Promise<void>;
};

export function useDeepgramSTT(
  options: UseDeepgramSTTOptions
): UseDeepgramSTTReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const stoppingRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cleanup = useCallback(() => {
    stoppingRef.current = false;
    if (mediaRecorderRef.current) {
      try { if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    finalTranscriptRef.current = "";
  }, []);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    if (mediaRecorderRef.current) {
      try { if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop(); } catch {}
    }
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "CloseStream" })); } catch {}
    }
    setVoiceState("processing");
  }, []);

  const speakText = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;
    ttsAbortRef.current?.abort();
    ttsAudioRef.current?.pause();
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    setVoiceState("speaking");
    try {
      const resp = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("TTS failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const audioCtx = audioCtxRef.current;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      setAnalyserNode(analyser);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    } finally {
      if (!controller.signal.aborted) {
        setVoiceState("idle");
        setAnalyserNode(null);
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (voiceState !== "idle" && voiceState !== "error") return;
    setErrorMessage(null);
    finalTranscriptRef.current = "";
    setVoiceState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setErrorMessage("Microphone access denied.");
      optionsRef.current.onError?.("Microphone access denied.");
      setVoiceState("error");
      return;
    }
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const audioCtx = audioCtxRef.current;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const micSource = audioCtx.createMediaStreamSource(stream);
    micSource.connect(analyser);
    setAnalyserNode(analyser);
    setVoiceState("connecting");
    let key: string;
    try {
      const res = await fetch("/api/voice/token");
      const data = await res.json() as { ok: boolean; key?: string; error?: string };
      if (!data.ok || !data.key) throw new Error(data.error ?? "Token fetch failed");
      key = data.key;
    } catch (e) {
      cleanup();
      setAnalyserNode(null);
      const msg = e instanceof Error ? e.message : "Could not connect to voice service";
      setErrorMessage(msg);
      optionsRef.current.onError?.(msg);
      setVoiceState("error");
      return;
    }
    const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=500`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, ["token", key]);
      wsRef.current = ws;
    } catch {
      cleanup();
      setAnalyserNode(null);
      setErrorMessage("Could not open voice connection.");
      optionsRef.current.onError?.("Could not open voice connection.");
      setVoiceState("error");
      return;
    }
    ws.onopen = () => {
      setVoiceState("listening");
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(e.data);
      };
      recorder.start(250);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string; is_final?: boolean;
          channel?: { alternatives?: { transcript?: string }[] };
        };
        if (msg.type === "Results") {
          const transcript = msg.channel?.alternatives?.[0]?.transcript ?? "";
          if (msg.is_final && transcript.trim()) {
            finalTranscriptRef.current = (finalTranscriptRef.current + " " + transcript).trim();
          }
        }
      } catch {}
    };
    ws.onerror = () => {
      cleanup(); setAnalyserNode(null);
      setErrorMessage("Voice connection error.");
      optionsRef.current.onError?.("Voice connection error.");
      setVoiceState("error");
    };
    ws.onclose = () => {
      const transcript = finalTranscriptRef.current.trim();
      cleanup(); setAnalyserNode(null);
      if (transcript) optionsRef.current.onTranscript(transcript);
      setVoiceState("idle");
    };
  }, [voiceState, cleanup]);

  useEffect(() => { return () => { cleanup(); }; }, [cleanup]);

  const isActive = voiceState === "requesting" || voiceState === "connecting" ||
    voiceState === "listening" || voiceState === "processing" || voiceState === "speaking";

  return { voiceState, start, stop, isActive, errorMessage, analyserNode, speakText };
}
