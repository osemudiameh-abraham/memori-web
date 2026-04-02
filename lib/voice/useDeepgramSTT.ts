"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "processing"
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
};

export function useDeepgramSTT(
  options: UseDeepgramSTTOptions
): UseDeepgramSTTReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const stoppingRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    stoppingRef.current = false;

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    finalTranscriptRef.current = "";
  }, []);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    }

    if (wsRef.current) {
      try {
        // Send close message to Deepgram to flush final transcript
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      } catch {}
    }

    setVoiceState("processing");
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
      options.onError?.("Microphone access denied.");
      setVoiceState("error");
      return;
    }

    setVoiceState("connecting");

    let key: string;
    try {
      const res = await fetch("/api/voice/token");
      const data = await res.json() as { ok: boolean; key?: string; error?: string };
      if (!data.ok || !data.key) throw new Error(data.error ?? "Token fetch failed");
      key = data.key;
    } catch (e) {
      cleanup();
      const msg = e instanceof Error ? e.message : "Could not connect to voice service";
      setErrorMessage(msg);
      options.onError?.(msg);
      setVoiceState("error");
      return;
    }

    const wsUrl =
      `wss://api.deepgram.com/v1/listen` +
      `?model=nova-2` +
      `&language=en` +
      `&smart_format=true` +
      `&interim_results=true` +
      `&endpointing=500`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, ["token", key]);
      wsRef.current = ws;
    } catch {
      cleanup();
      setErrorMessage("Could not open voice connection.");
      options.onError?.("Could not open voice connection.");
      setVoiceState("error");
      return;
    }

    ws.onopen = () => {
      setVoiceState("listening");

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (
          e.data.size > 0 &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          wsRef.current.send(e.data);
        }
      };

      recorder.start(250);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          is_final?: boolean;
          channel?: {
            alternatives?: { transcript?: string }[];
          };
        };

        if (msg.type === "Results") {
          const transcript =
            msg.channel?.alternatives?.[0]?.transcript ?? "";

          if (msg.is_final && transcript.trim()) {
            finalTranscriptRef.current =
              (finalTranscriptRef.current + " " + transcript).trim();
          }
        }

        if (msg.type === "Metadata" || msg.type === "SpeechStarted") {
          // ignore
        }

        if (
          msg.type === "Results" &&
          (event.data as string).includes('"speech_final":true')
        ) {
          // speech_final means Deepgram detected end of utterance
          // We will let the user stop manually for now
        }
      } catch {}
    };

    ws.onerror = () => {
      cleanup();
      setErrorMessage("Voice connection error.");
      options.onError?.("Voice connection error.");
      setVoiceState("error");
    };

    ws.onclose = () => {
      const transcript = finalTranscriptRef.current.trim();
      cleanup();

      if (transcript) {
        options.onTranscript(transcript);
        setVoiceState("idle");
      } else if (stoppingRef.current) {
        setVoiceState("idle");
      } else {
        setVoiceState("idle");
      }
    };
  }, [voiceState, cleanup, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const isActive =
    voiceState === "requesting" ||
    voiceState === "connecting" ||
    voiceState === "listening" ||
    voiceState === "processing";

  return { voiceState, start, stop, isActive, errorMessage };
}
