import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wires TALA to the OFFICIAL Dograh headless embed widget
 * (https://app.dograh.com/embed/dograh-widget.js).
 *
 * IMPORTANT — read this before changing the state-mapping logic:
 *
 * I read the widget's source (it's open-source, same script Dograh serves
 * from app.dograh.com). Its WebSocket message handler only processes
 * `answer`, `ice-candidate`, `error`, and `call-ended`. It does NOT forward
 * the `rtf-bot-started-speaking` / `rtf-user-transcription` / etc. events —
 * those are silently dropped inside the widget. That means
 * `window.DograhWidget.onStatusChange()` — the widget's own public,
 * documented callback — can only ever report connection lifecycle:
 * 'idle' | 'connecting' | 'connected' | 'failed'. It cannot natively tell
 * you whether the bot is currently speaking or thinking.
 *
 * So "listening / thinking / speaking" below is NOT a native widget
 * feature. It's a best-effort approximation built on top of:
 *   - Local mic amplitude (via Web Audio AnalyserNode on the mic stream)
 *   - Remote (bot) audio amplitude (via AnalyserNode on the bot's audio)
 *
 * To get those streams at all, this reads `window.DograhWidget.getState()`
 * — which returns the widget's *internal* mutable state object by
 * reference. `getState()` itself is part of the documented public API,
 * but the field names on what it returns (`.stream`, `.audioElement`) are
 * NOT part of Dograh's documented contract — they're implementation
 * details that happened to be readable. If Dograh ships a widget update
 * that renames/removes those fields, this approximation silently stops
 * working (it degrades to "listening" the whole call — see the fallback
 * branch below) rather than throwing, but it could drift out of sync.
 *
 * If you want a guaranteed-accurate listening/thinking/speaking split,
 * the only way to get it is the raw-WebRTC approach I built before this
 * (driving the WebSocket signaling directly so the rtf-* events are
 * visible to your own code) — happy to swap back to that if this
 * heuristic isn't good enough in practice.
 */

const EMBED_TOKEN = 'emb_6WVY9tQoPl4jQNzhnqfAEL7s335lAZiZCtCVvvBW0Zs';
const EMBED_ENVIRONMENT = 'production';
const EMBED_API_ENDPOINT = 'https://api.dograh.com';
const SCRIPT_ID = 'dograh-widget';
const EMBED_SCRIPT_SRC = `https://app.dograh.com/embed/dograh-widget.js?token=${EMBED_TOKEN}&environment=${EMBED_ENVIRONMENT}&apiEndpoint=${EMBED_API_ENDPOINT}`;

export type TalaVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

type DograhConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

interface DograhWidgetState {
  stream?: MediaStream | null;
  audioElement?: HTMLAudioElement | null;
  connectionStatus?: DograhConnectionStatus;
}

interface DograhWidgetGlobal {
  start: () => void;
  stop: () => void;
  end: () => void;
  onStatusChange: (cb: (status: DograhConnectionStatus, text?: string, subtext?: string) => void) => void;
  onError: (cb: (err: Error) => void) => void;
  onCallEnd: (cb: () => void) => void;
  getState: () => DograhWidgetState;
}

declare global {
  interface Window {
    DograhWidget?: DograhWidgetGlobal;
  }
}

// Amplitude thresholds for the heuristic — tune these against your own
// mic/speaker setup. 0-255 scale (Uint8Array time-domain deviation from 128).
const SPEAKING_THRESHOLD = 8;
const LISTENING_THRESHOLD = 6;
const THINKING_TIMEOUT_MS = 8000; // safety fallback if the bot never replies

function rms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    const deviation = buffer[i] - 128;
    sumSquares += deviation * deviation;
  }
  return Math.sqrt(sumSquares / buffer.length);
}

export function useDograhWidget() {
  const [voiceState, setVoiceState] = useState<TalaVoiceState>('idle');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const widgetReadyRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const userWasSpeakingRef = useRef(false);
  const thinkingSinceRef = useRef<number | null>(null);
  const wiredStreamRef = useRef<MediaStream | null>(null);
  const wiredAudioElRef = useRef<HTMLAudioElement | null>(null);

  // --- Inject the official embed script exactly as provided ---
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) {
      widgetReadyRef.current = true;
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = EMBED_SCRIPT_SRC;
    script.async = true;
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);
  }, []);

  // --- Wait for window.DograhWidget to exist, then register callbacks ---
  useEffect(() => {
    let cancelled = false;
    let pollId: number;

    const waitForWidget = () => {
      if (window.DograhWidget) {
        if (cancelled) return;
        window.DograhWidget.onStatusChange((status) => {
          if (status === 'connecting') {
            setIsConnecting(true);
          } else if (status === 'connected') {
            setIsConnecting(false);
            setVoiceState('listening'); // default resting state once live
          } else if (status === 'failed') {
            setIsConnecting(false);
            setVoiceState('idle');
            setErrorMessage('Voice call failed — check your mic and try again');
            stopAmplitudeLoop();
          } else if (status === 'idle') {
            setIsConnecting(false);
            setVoiceState('idle');
            stopAmplitudeLoop();
          }
        });
        window.DograhWidget.onError((err) => setErrorMessage(err.message || 'Voice call error'));
        window.DograhWidget.onCallEnd(() => {
          setVoiceState('idle');
          setIsConnecting(false);
          stopAmplitudeLoop();
        });
        return;
      }
      pollId = window.setTimeout(waitForWidget, 100);
    };

    waitForWidget();
    return () => {
      cancelled = true;
      window.clearTimeout(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAmplitudeLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    remoteAnalyserRef.current = null;
    localAnalyserRef.current = null;
    wiredStreamRef.current = null;
    wiredAudioElRef.current = null;
    userWasSpeakingRef.current = false;
    thinkingSinceRef.current = null;
  }, []);

  // --- Best-effort listening/thinking/speaking loop ---
  // Re-wires the analysers whenever the widget's internal stream/audioElement
  // change (e.g. once a call connects and tracks attach), then samples
  // amplitude every animation frame.
  const tick = useCallback(() => {
    const state = window.DograhWidget?.getState();
    if (!state || state.connectionStatus !== 'connected') {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // (Re)wire analysers if the widget's stream/audioElement are new.
    if (state.stream && state.stream !== wiredStreamRef.current) {
      wiredStreamRef.current = state.stream;
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(state.stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      localAnalyserRef.current = analyser;
    }

    const remoteStream = state.audioElement?.srcObject as MediaStream | undefined;
    if (remoteStream && state.audioElement !== wiredAudioElRef.current) {
      wiredAudioElRef.current = state.audioElement ?? null;
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      remoteAnalyserRef.current = analyser;
    }

    const remoteAnalyser = remoteAnalyserRef.current;
    const localAnalyser = localAnalyserRef.current;

    if (remoteAnalyser) {
      const buf = new Uint8Array(remoteAnalyser.fftSize);
      const level = rms(remoteAnalyser, buf);
      if (level > SPEAKING_THRESHOLD) {
        setVoiceState('speaking');
        userWasSpeakingRef.current = false;
        thinkingSinceRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
    }

    if (localAnalyser) {
      const buf = new Uint8Array(localAnalyser.fftSize);
      const level = rms(localAnalyser, buf);
      if (level > LISTENING_THRESHOLD) {
        setVoiceState('listening');
        userWasSpeakingRef.current = true;
        thinkingSinceRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
    }

    // Both quiet. If the user just stopped talking, assume the agent is
    // processing a reply until either remote audio starts (handled above)
    // or a timeout passes (in case the bot doesn't respond).
    if (userWasSpeakingRef.current) {
      userWasSpeakingRef.current = false;
      thinkingSinceRef.current = Date.now();
      setVoiceState('thinking');
    } else if (
      thinkingSinceRef.current &&
      Date.now() - thinkingSinceRef.current > THINKING_TIMEOUT_MS
    ) {
      thinkingSinceRef.current = null;
      setVoiceState('listening');
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    if (!window.DograhWidget) {
      setErrorMessage('Voice widget is still loading — try again in a moment');
      return;
    }
    setErrorMessage(null);
    window.DograhWidget.start();
    stopAmplitudeLoop();
    rafRef.current = requestAnimationFrame(tick);
  }, [stopAmplitudeLoop, tick]);

  const stop = useCallback(() => {
    window.DograhWidget?.end();
    stopAmplitudeLoop();
    setVoiceState('idle');
    setIsConnecting(false);
  }, [stopAmplitudeLoop]);

  useEffect(() => () => stopAmplitudeLoop(), [stopAmplitudeLoop]);

  return { voiceState, isConnecting, errorMessage, start, stop };
}
