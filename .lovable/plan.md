## Status: already implemented

Every change you requested is already present in the project from the previous turn. Here's the verification:

| Requirement                           | Status                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Install `kokoro-js`                   | ✅ `"kokoro-js": "^1.2.1"` in `package.json`                                                                 |
| Delete `src/hooks/useDograhWidget.ts` | ✅ Gone (only `useTalaVoice.ts` and `use-mobile.tsx` remain in `src/hooks/`)                                 |
| Create `src/hooks/useTalaVoice.ts`    | ✅ Exists — STT via Web Speech API, AI via OpenRouter `openrouter/free`, TTS via Kokoro-82M voice `af_heart` |
| Update `TalaApp.tsx` import           | ✅ `import { useTalaVoice } from "../hooks/useTalaVoice"` and used at line 1189                              |
| Add `VITE_OPENROUTER_KEY` to `.env`   | ✅ Present (placeholder value)                                                                               |
| Hands-free voice loop                 | ✅ `processUserSpeech` cycles listening → thinking → speaking → listening                                    |

## What's left for you

The `.env` currently holds a placeholder:

```
VITE_OPENROUTER_KEY=your_openrouter_api_key_here
```

The voice AI won't respond until this is replaced with your real key from [openrouter.ai](https://openrouter.ai/keys). Because this is a `VITE_`-prefixed variable, it's bundled into the browser build (required for a client-side hook) — so treat it as a low-privilege key.

## Optional refinement (if you approve)

If you'd like, I can, in build mode:

1. Do a clean production build to confirm `kokoro-js` bundles without SSR/Worker errors.
2. Add a small in-app notice/error state when `VITE_OPENROUTER_KEY` is still the placeholder, so the failure is visible to users instead of silent.

Otherwise, no code changes are needed — just add your OpenRouter key.
