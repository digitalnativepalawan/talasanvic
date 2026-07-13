import { useCallback, useEffect, useRef, useState } from "react";
import { KokoroTTS } from "kokoro-js";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
  interface Navigator {
    gpu?: {
      requestAdapter(options?: Record<string, unknown>): Promise<unknown>;
    };
  }
}

/**
 * TALA Voice Hook — fully open-source voice stack.
 *
 * STT:  Web Speech API (browser built-in, Chrome/Edge)
 * AI:   OpenRouter free model (openrouter/free or specific model)
 * TTS:  Kokoro-82M via kokoro-js (runs 100% in browser, Apache 2.0)
 *
 * Voice state machine: idle → listening → thinking → speaking → listening
 * (cycles back for hands-free continuous conversation)
 */

export type TalaVoiceState = "idle" | "listening" | "thinking" | "speaking";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const TALA_SYSTEM_PROMPT = `You are TALA, a warm and knowledgeable AI voice concierge for San Vicente, Palawan, Philippines. You help travelers discover food, tours, accommodations, beaches, sunsets, transport, and local events. You speak naturally, like a friendly local guide — concise, helpful, and conversational. Keep responses under 3 sentences unless the user asks for detail. Use a warm, welcoming tone. You know about Long Beach (14.7km), Port Barton island hopping, Cape San Vicente sunset cliff, local jeepney schedules, scooter rentals, and community events like bonfires. When recommending places, mention distances and prices when relevant. If someone asks about reservations, tell them you can help them reserve. You are not a bot — you ARE TALA, the island assistant.`;

// OpenRouter API
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openrouter/free";

// Kokoro voice — af_heart is warm, natural American female
const KOKORO_VOICE = "af_heart";

// Speech recognition config
const SpeechRecognitionCtor =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function useTalaVoice() {
  const [voiceState, setVoiceState] = useState<TalaVoiceState>("idle");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ttsRef = useRef<KokoroTTS | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const chatHistoryRef = useRef<ChatMessage[]>([{ role: "system", content: TALA_SYSTEM_PROMPT }]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isSpeakingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const finalTranscriptRef = useRef("");

  // Initialize Kokoro TTS on mount
  useEffect(() => {
    let cancelled = false;

    async function initTTS() {
      try {
        const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: "q8",
          device: navigator.gpu ? "webgpu" : "wasm",
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

  // Play TTS audio from text
  const speakText = useCallback(async (text: string): Promise<void> => {
    const tts = ttsRef.current;
    if (!tts) {
      // No TTS available — just wait a bit to simulate speaking
      await new Promise((r) => setTimeout(r, 1500));
      return;
    }

    try {
      const result = await tts.generate(text, { voice: KOKORO_VOICE });

      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;

      // Convert Float32Array samples to AudioBuffer
      const audioData = result.audio;
      const sampleRate = result.sampling_rate ?? 24000;
      const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
      buffer.getChannelData(0).set(audioData);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      isSpeakingRef.current = true;
      setVoiceState("speaking");

      return new Promise<void>((resolve) => {
        source.onended = () => {
          isSpeakingRef.current = false;
          resolve();
        };
        source.start();
      });
    } catch (err) {
      console.error("TTS generation failed:", err);
      // Fallback — just wait
      await new Promise((r) => setTimeout(r, 1500));
    }
  }, []);

  // Call OpenRouter for AI response
  const getAIResponse = useCallback(async (userText: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENROUTER_KEY;
    if (!apiKey) {
      return "I'm sorry — my AI brain isn't configured yet. Please add your OpenRouter API key to the .env file.";
    }

    chatHistoryRef.current.push({ role: "user", content: userText });

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "TALA - SanVic.ph",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: chatHistoryRef.current,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenRouter ${res.status}`);
      }

      const data = await res.json();
      const reply =
        data.choices?.[0]?.message?.content ?? "I didn't catch that — could you say it again?";

      chatHistoryRef.current.push({ role: "assistant", content: reply });

      // Keep history manageable (system + last 20 messages)
      if (chatHistoryRef.current.length > 21) {
        chatHistoryRef.current = [chatHistoryRef.current[0], ...chatHistoryRef.current.slice(-20)];
      }

      return reply;
    } catch (err) {
      console.error("OpenRouter error:", err);
      return "I'm having trouble connecting right now — try again in a moment.";
    }
  }, []);

  // Process user speech → AI → TTS → listen again
  const processUserSpeech = useCallback(
    async (text: string) => {
      setVoiceState("thinking");

      // Get AI response
      const reply = await getAIResponse(text);

      // Speak it
      await speakText(reply);

      // Resume listening if still in call
      if (shouldListenRef.current) {
        if (SpeechRecognitionCtor) {
          const recognition = new SpeechRecognitionCtor();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = "en-US";
          recognition.maxAlternatives = 1;

          recognition.onstart = () => {
            setVoiceState("listening");
            finalTranscriptRef.current = "";
          };

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscriptRef.current += transcript;
              }
            }
          };

          recognition.onend = () => {
            const recognizedText = finalTranscriptRef.current.trim();
            if (recognizedText) {
              processUserSpeech(recognizedText);
            } else if (shouldListenRef.current) {
              setVoiceState("idle");
              shouldListenRef.current = false;
            }
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onerror = (event: any) => {
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
        }
      } else {
        setVoiceState("idle");
      }
    },
    [getAIResponse, speakText],
  );

  // Start speech recognition
  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setErrorMessage("Speech recognition not supported — use Chrome or Edge");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState("listening");
      finalTranscriptRef.current = "";
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript;
        }
      }
    };

    recognition.onend = () => {
      const text = finalTranscriptRef.current.trim();
      if (text) {
        processUserSpeech(text);
      } else if (shouldListenRef.current) {
        setVoiceState("idle");
        shouldListenRef.current = false;
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
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
  }, [processUserSpeech]);

  // Start voice call
  const start = useCallback(() => {
    setErrorMessage(null);
    shouldListenRef.current = true;
    setIsConnecting(false); // No connection step needed — we're local
    startListening();
  }, [startListening]);

  // Stop voice call
  const stop = useCallback(() => {
    shouldListenRef.current = false;
    isSpeakingRef.current = false;

    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Stop any playing audio
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    setVoiceState("idle");
    setIsConnecting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return {
    voiceState,
    isConnecting,
    errorMessage,
    start,
    stop,
  };
}
