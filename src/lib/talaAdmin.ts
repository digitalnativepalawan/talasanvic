// Server-only TALA admin functions.
// Runs on the server (never bundled to the client). Uses the service-role key
// to read/write admin config and knowledge base from Supabase.
import { createServerFn } from "@tanstack/react-start";

interface AiConfig {
  id: string;
  active_provider: string;
  primary_model: string;
  openrouter_api_key: string | null;
  temperature: number;
  guest_max_tokens: number;
  updated_at: string;
}

interface KnowledgeEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string | null;
  active: boolean;
  sort_order: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// GET admin config
// ---------------------------------------------------------------------------
export const getAdminConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("ai_assistant_config" as any)
      .select("*")
      .eq("id", "default")
      .single();

    if (error) {
      console.error("[TALA Admin] Failed to load config:", error.message);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, config: data as unknown as AiConfig };
  },
);

// ---------------------------------------------------------------------------
// UPDATE admin config (OpenRouter key, model, temperature, etc.)
// ---------------------------------------------------------------------------
export const updateAdminConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) =>
      data as {
        openrouter_api_key?: string;
        primary_model?: string;
        temperature?: number;
        guest_max_tokens?: number;
      },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.openrouter_api_key !== undefined) update.openrouter_api_key = data.openrouter_api_key;
    if (data.primary_model !== undefined) update.primary_model = data.primary_model;
    if (data.temperature !== undefined) update.temperature = data.temperature;
    if (data.guest_max_tokens !== undefined) update.guest_max_tokens = data.guest_max_tokens;

    const { error } = await supabaseAdmin
      .from("ai_assistant_config" as any)
      .update(update)
      .eq("id", "default");

    if (error) {
      console.error("[TALA Admin] Failed to update config:", error.message);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// GET all knowledge base entries
// ---------------------------------------------------------------------------
export const getKnowledgeBase = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("ai_knowledge_base" as any)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[TALA Admin] Failed to load knowledge base:", error.message);
      return { ok: false as const, error: error.message };
    }

    return {
      ok: true as const,
      entries: (data ?? []) as unknown as KnowledgeEntry[],
    };
  },
);

// ---------------------------------------------------------------------------
// UPSERT a knowledge base entry
// ---------------------------------------------------------------------------
export const upsertKnowledgeEntry = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) =>
      data as {
        id?: string;
        category: string;
        question: string;
        answer: string;
        keywords?: string;
        active?: boolean;
        sort_order?: number;
      },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const row: Record<string, unknown> = {
      category: data.category,
      question: data.question,
      answer: data.answer,
      keywords: data.keywords ?? null,
      active: data.active ?? true,
      sort_order: data.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (data.id) {
      // Update existing
      result = await supabaseAdmin
        .from("ai_knowledge_base" as any)
        .update(row)
        .eq("id", data.id);
    } else {
      // Insert new
      result = await supabaseAdmin
        .from("ai_knowledge_base" as any)
        .insert(row);
    }

    if (result.error) {
      console.error("[TALA Admin] Failed to upsert entry:", result.error.message);
      return { ok: false as const, error: result.error.message };
    }

    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// DELETE a knowledge base entry
// ---------------------------------------------------------------------------
export const deleteKnowledgeEntry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error } = await supabaseAdmin
      .from("ai_knowledge_base" as any)
      .delete()
      .eq("id", data.id);

    if (error) {
      console.error("[TALA Admin] Failed to delete entry:", error.message);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  });
