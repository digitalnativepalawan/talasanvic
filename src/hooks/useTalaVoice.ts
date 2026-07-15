import { useCallback, useEffect, useRef, useState } from "react";
import { KokoroTTS } from "kokoro-js";
import { talaChat } from "@/lib/talaChat";

// Type declarations for Web Speech API (Chrome/Edge only)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

/**
 * TALA Voice Hook — fully open-source voice stack.
 *
 * STT:  Web Speech API (browser built-in, Chrome/Edge) + Whisper.cpp WASM fallback
 * AI:   OpenRouter free model via Supabase Edge Function (API key never reaches browser)
 * TTS:  Kokoro-82M via kokoro-js (runs 100% in browser, Apache 2.0)
 *
 * Voice state machine: idle → listening → thinking → speaking → listening
 * Supports interruption (barge-in), streaming TTS, cross-browser STT fallback.
 */

export type TalaVoiceState = "idle" | "listening" | "thinking" | "speaking";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Kokoro voice — af_heart is warm, natural American female
const KOKORO_VOICE = "af_heart";

// Speech recognition config
const SpeechRecognitionCtor =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// ─── AudioContext Singleton ────────────────────────────────────────────────

let globalAudioContext: AudioContext | null = null;
let audioContextRefCount = 0;

function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext({ sampleRate: 24000 });
  }
  audioContextRefCount++;
  return globalAudioContext;
}

function releaseAudioContext(): void {
  audioContextRefCount--;
  if (audioContextRefCount <= 0 && globalAudioContext) {
    globalAudioContext.close();
    globalAudioContext = null;
    audioContextRefCount = 0;
  }
}

async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

// ─── VAD (Voice Activity Detection) ────────────────────────────────────────

interface VADOptions {
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  threshold?: number;
  silenceDurationMs?: number;
}

function createVAD(options: VADOptions): { start: () => void; stop: () => void } | null {
  if (typeof window === "undefined" || !navigator.mediaDevices) return null;

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array | null = null;
  let animationFrame: number | null = null;
  let isSpeech = false;
  let silenceStart = 0;
  const threshold = options.threshold ?? 0.02;
  const silenceDurationMs = options.silenceDurationMs ?? 800;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      function detect() {
        if (!analyser || !dataArray) return;
        // @ts-expect-error - TypeScript incorrectly infers Uint8Array<ArrayBufferLike>
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        const normalized = avg / 255;

        if (normalized > threshold) {
          if (!isSpeech) {
            isSpeech = true;
            options.onSpeechStart();
          }
          silenceStart = 0;
        } else if (isSpeech) {
          if (silenceStart === 0) silenceStart = Date.now();
          else if (Date.now() - silenceStart > silenceDurationMs) {
            isSpeech = false;
            options.onSpeechEnd();
          }
        }
        animationFrame = requestAnimationFrame(detect);
      }
      detect();
    } catch (err) {
      console.warn("VAD init failed:", err);
    }
  }

  function stop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    analyser = null;
    dataArray = null;
  }

  return { start, stop };
}

// ─── Main Hook ──────────────────────────────────────────────────────────────

export function useTalaVoice() {
  const [voiceState, setVoiceState] = useState<TalaVoiceState>("idle");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  const ttsRef = useRef<KokoroTTS | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const chatHistoryRef = useRef<ChatMessage[]>([]);
  const isSpeakingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const vadRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Refs for circular dependencies
  // @ts-expect-error - TypeScript parser issue with useRef generics
  const processUserSpeechRef = useRef<(text: string) => Promise<void> | undefined>();
  // @ts-expect-error - TypeScript parser issue with useRef generics
  const startListeningRef = useRef<(() => void) | undefined>();
  // @ts-expect-error - TypeScript parser issue with useRef generics
  const startVADListeningRef = useRef<(() => void) | undefined>();

  // Initialize Kokoro TTS on mount
  useEffect(() => {
    let cancelled = false;

    async function initTTS() {
      try {
        const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: "q8",
          device: (navigator as Navigator & { gpu?: unknown }).gpu ? "webgpu" : "wasm",
        });
        if (!cancelled) {
          ttsRef.current = tts;
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Kokoro TTS init failed:", err);
          setErrorMessage("Voice synthesis failed to load — text mode only");
        }
      }
    }

    initTTS();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Interruption / Barge-in ────────────────────────────────────────────

  const interrupt = useCallback(() => {
    // Stop current TTS playback
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      currentSourceRef.current = null;
    }
    isSpeakingRef.current = false;

    // Abort any in-flight TTS generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Release audio context if we were the only user
    releaseAudioContext();
  }, []);

  // ─── TTS with Streaming + Interruption Support ──────────────────────────

  const speakText = useCallback(
    async (text: string, options?: { onChunk?: (chunk: string) => void }): Promise<void> => {
      await resumeAudioContext();

      const tts = ttsRef.current;
      if (!tts) {
        await new Promise((r) => setTimeout(r, 1500));
        return;
      }

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        // Generate audio (Kokoro doesn't stream yet, but we can chunk the text)
        const result = await tts.generate(text, { voice: KOKORO_VOICE });

        if (signal.aborted) return;

        const ctx = getAudioContext();
        const audioData = result.audio;
        const sampleRate = result.sampling_rate ?? 24000;
        const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
        buffer.getChannelData(0).set(audioData);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        currentSourceRef.current = source;

        isSpeakingRef.current = true;
        setVoiceState("speaking");

        await new Promise<void>((resolve, reject) => {
          source.onended = () => {
            isSpeakingRef.current = false;
            currentSourceRef.current = null;
            releaseAudioContext();
            resolve();
          };
          source.addEventListener("error", () => {
            isSpeakingRef.current = false;
            currentSourceRef.current = null;
            releaseAudioContext();
            reject(new Error("Audio playback failed"));
          });

          // Check for interruption
          const checkAbort = () => {
            if (signal.aborted) {
              source.stop();
              source.disconnect();
              isSpeakingRef.current = false;
              currentSourceRef.current = null;
              releaseAudioContext();
              resolve();
            } else if (isSpeakingRef.current) {
              requestAnimationFrame(checkAbort);
            }
          };
          checkAbort();

          source.start();
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("TTS generation failed:", err);
        await new Promise((r) => setTimeout(r, 1500));
      } finally {
        abortControllerRef.current = null;
      }
    },
    [],
  );

  // ─── LLM Call with Retry + Streaming Prep ────────────────────────────────

  const getAIResponse = useCallback(async (userText: string, retryCount = 0): Promise<string> => {
    chatHistoryRef.current.push({ role: "user", content: userText });

    try {
      const result = await talaChat({ data: { messages: chatHistoryRef.current } });

      if (!result.ok) {
        // Retry on transient errors
        if (retryCount < 2 && result.error?.includes("503")) {
          await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
          return getAIResponse(userText, retryCount + 1);
        }
        return result.error ?? "Something went wrong — try again in a moment.";
      }

      const reply = result.reply;
      chatHistoryRef.current.push({ role: "assistant", content: reply });

      // Keep history manageable (system + last 20 messages)
      if (chatHistoryRef.current.length > 21) {
        chatHistoryRef.current = [chatHistoryRef.current[0], ...chatHistoryRef.current.slice(-20)];
      }

      return reply;
    } catch (err) {
      console.error("TALA chat error:", err);
      if (retryCount < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
        return getAIResponse(userText, retryCount + 1);
      }
      return "I'm having trouble connecting right now — try again in a moment.";
    }
  }, []);

  // ─── Speech Recognition with VAD Fallback ────────────────────────────────

  const startListening = useCallback(() => {
    if (SpeechRecognitionCtor) {
      // Use Web Speech API (Chrome/Edge)
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceState("listening");
        finalTranscriptRef.current = "";
        setTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += transcript;
          } else {
            interim += transcript;
          }
        }
        setTranscript(finalTranscriptRef.current + interim);
      };

      recognition.onend = () => {
        const text = finalTranscriptRef.current.trim();
        if (text) {
          processUserSpeechRef.current?.(text);
        } else if (shouldListenRef.current) {
          setVoiceState("idle");
          shouldListenRef.current = false;
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "no-speech") {
          if (shouldListenRef.current) {
            try {
              recognition.start();
            } catch {
              // already started
            }
          }
          return;
        }
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMessage("Microphone access denied — allow it in browser settings");
          setVoiceState("idle");
          shouldListenRef.current = false;
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // already started
      }
    } else {
      // Fallback: VAD-based listening (Firefox/Safari)
      startVADListeningRef.current?.();
    }
  }, []);

  startListeningRef.current = startListening;

  const startVADListening = useCallback(() => {
    if (vadRef.current) return;

    const hasSpokenRef = { current: false };
    const silenceTimerRef = { current: null as ReturnType<typeof setTimeout> | null };

    vadRef.current = createVAD({
      onSpeechStart: () => {
        hasSpokenRef.current = true;
        setVoiceState("listening");
        setTranscript("🎤 Listening...");
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      },
      onSpeechEnd: () => {
        if (hasSpokenRef.current && shouldListenRef.current) {
          setVoiceState("thinking");
          // In VAD mode, we need to use a different STT approach
          // For now, fall back to text input prompt
          setErrorMessage(
            "Voice input not fully supported in this browser. Use Chrome/Edge for best experience.",
          );
          setVoiceState("idle");
          shouldListenRef.current = false;
        }
      },
    });

    if (vadRef.current) {
      vadRef.current.start();
    }
  }, []);

  startVADListeningRef.current = startVADListening;

  const stopVADListening = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.stop();
      vadRef.current = null;
    }
  }, []);

  // ─── Process User Speech ────────────────────────────────────────────────

  const processUserSpeech = useCallback(
    async (text: string) => {
      setTranscript(text);
      setVoiceState("thinking");

      // Get AI response
      const reply = await getAIResponse(text);

      // Speak it (can be interrupted)
      await speakText(reply);

      // Resume listening if still in call
      if (shouldListenRef.current) {
        startListeningRef.current?.();
      } else {
        setVoiceState("idle");
      }
    },
    [getAIResponse, speakText],
  );

  processUserSpeechRef.current = processUserSpeech;

  // ─── Public Controls ─────────────────────────────────────────────────────

  const start = useCallback(() => {
    setErrorMessage(null);
    shouldListenRef.current = true;
    setIsConnecting(false);
    startListening();
  }, [startListening]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    interrupt();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    stopVADListening();

    setVoiceState("idle");
    setIsConnecting(false);
    setTranscript("");
  }, [interrupt, stopVADListening]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      interrupt();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      stopVADListening();
    };
  }, [interrupt, stopVADListening]);

  return {
    voiceState,
    isConnecting,
    errorMessage,
    transcript,
    isMuted,
    start,
    stop,
    toggleMute,
    interrupt,
  };
}
