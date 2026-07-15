// Server-only TALA chat function.
// Runs on the server (never bundled to the client). Reads the OpenRouter API key
// and the knowledge base from TALA's own Supabase, then calls OpenRouter.
// This keeps the API key out of the browser bundle entirely.
import { createServerFn } from "@tanstack/react-start";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface TalaChatInput {
  messages: ChatMessage[];
}

const TALA_BASE_PROMPT = `You are TALA, a warm and knowledgeable AI voice concierge for San Vicente, Palawan, Philippines. You help travelers discover food, tours, accommodations, beaches, sunsets, transport, and local events. You speak naturally, like a friendly local guide — concise, helpful, and conversational. Keep responses under 3 sentences unless the user asks for detail. Use a warm, welcoming tone. You are not a bot — you ARE TALA, the island assistant.`;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Read from Supabase REST using the service-role key (server-side only).
async function supabaseGet(path: string, serviceKey: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase read failed (${res.status})`);
  return res.json();
}

function buildKnowledgeBlock(rows: Array<{ category: string; question: string; answer: string }>) {
  if (!rows?.length) return "";
  const lines = rows.map((r) => `[${r.category}] ${r.question} → ${r.answer}`);
  return `KNOWLEDGE BASE (authoritative answers):\n${lines.join("\n")}`;
}

export const talaChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as TalaChatInput)
  .handler(async ({ data }) => {
    const baseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!baseUrl || !serviceKey) {
      return {
        ok: false as const,
        error: "TALA is not configured — missing Supabase server credentials.",
      };
    }

    // Load config (OpenRouter key + model).
    let apiKey: string | undefined;
    let model = "openrouter/auto";
    try {
      const cfg = await supabaseGet(
        "ai_assistant_config?select=openrouter_api_key,primary_model&id=eq.default",
        serviceKey,
        baseUrl,
      );
      const row = cfg?.[0];
      apiKey = row?.openrouter_api_key || undefined;
      if (row?.primary_model) model = row.primary_model;
    } catch {
      // fall through with defaults
    }

    if (!apiKey) {
      return {
        ok: false as const,
        error: "TALA's AI brain isn't configured yet — add your OpenRouter key in the admin.",
      };
    }

    // Load active knowledge base entries.
    let knowledge = "";
    try {
      const kb = await supabaseGet(
        "ai_knowledge_base?select=category,question,answer&active=eq.true&order=sort_order.asc&limit=300",
        serviceKey,
        baseUrl,
      );
      knowledge = buildKnowledgeBlock(kb || []);
    } catch {
      // optional — proceed without KB
    }

    const systemPrompt = knowledge ? `${TALA_BASE_PROMPT}\n\n${knowledge}` : TALA_BASE_PROMPT;

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            typeof window === "undefined" ? "https://sanvic.ph" : window.location.origin,
          "X-Title": "TALA - SanVic.ph",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false as const, error: `OpenRouter ${res.status}: ${text.slice(0, 200)}` };
      }

      const json = await res.json();
      const reply =
        json?.choices?.[0]?.message?.content ?? "I didn't catch that — could you say it again?";

      return { ok: true as const, reply: reply.trim() };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "OpenRouter request failed",
      };
    }
  });
