-- TALA voice concierge: key + knowledge storage (TALA's own Supabase project).
-- Run this in the TALA Supabase project's SQL editor (the one with VITE_SUPABASE_URL
-- ending in opriirvdlgtjynlilepe.supabase.co).

-- ---------------------------------------------------------------------------
-- Config: holds the OpenRouter API key + model (set via admin, read server-side).
-- Never exposed to the browser.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_assistant_config (
  id text PRIMARY KEY DEFAULT 'default',
  active_provider text NOT NULL DEFAULT 'openrouter',
  primary_model text NOT NULL DEFAULT 'openrouter/auto',
  openrouter_api_key text,
  fallback_api_key text,
  fallback_base_url text,
  fallback_model text,
  ollama_base_url text,
  temperature numeric NOT NULL DEFAULT 0.7,
  guest_max_tokens integer NOT NULL DEFAULT 200,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; block all anon/authenticated client access to the key.
CREATE POLICY "no client access" ON public.ai_assistant_config
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Knowledge base: the answers TALA draws from.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  question text NOT NULL,
  answer text NOT NULL,
  keywords text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no client access" ON public.ai_knowledge_base
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Seed knowledge (reused from BAIA guest concierge guidance, tuned for TALA's
-- voice: San Vicente island assistant). Idempotent.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_knowledge_base (category, question, answer, keywords, active, sort_order)
VALUES
  ('resort', 'What is TALA?', 'TALA is your AI voice concierge for San Vicente, Palawan — a warm local guide for food, tours, beaches, sunsets, transport, and events. I am TALA, the island assistant, not a bot.', 'TALA, who are you, assistant, Palawan, San Vicente', true, 10),
  ('resort', 'What is BAIA?', 'BAIA is a boutique resort here in San Vicente, Palawan. For current prices, rooms, and availability, ask Reception — I can point you the right way.', 'BAIA, resort, boutique, San Vicente', true, 11),
  ('beaches', 'Where is Long Beach?', 'Long Beach is about 14.7 kilometers of white sand — one of the longest in the Philippines. It is a short drive or scooter ride from the resort. Sunset there is unforgettable.', 'Long Beach, beach, white sand, longest, 14.7km', true, 20),
  ('beaches', 'Where can I watch the sunset?', 'Cape San Vicente has a dramatic sunset cliff west of town. Long Beach is also a favorite for golden-hour walks. I can tell you the best time to go.', 'sunset, Cape San Vicente, cliff, golden hour', true, 21),
  ('tours', 'What tours can I do?', 'Port Barton island hopping is the classic — swimming, snorkeling, and sandbars. Closer in, you can do river tours, waterfalls, and the Long Beach stretch. Reception can help you reserve.', 'tours, island hopping, Port Barton, snorkel, waterfall, river', true, 30),
  ('tours', 'How do I book a tour?', 'I can explain the options, but booking and confirmation go through Reception. Just say the word and I will tell you what to ask for.', 'book tour, reserve, confirm, reservation', true, 31),
  ('transport', 'How do I get around?', 'Scooter rentals are the easiest way to explore. Local jeepneys run on set schedules between towns. For airport or pier transfers, Reception can arrange a pickup.', 'transport, scooter, jeepney, rental, transfer, get around', true, 40),
  ('transport', 'How do I get to Port Barton or Puerto Princesa?', 'Port Barton is about 1.5 to 2 hours by road. Puerto Princesa airport is roughly 3 to 4 hours away. Reception can arrange a van or shuttle.', 'Port Barton, Puerto Princesa, airport, transfer, van, shuttle', true, 41),
  ('food', 'Where should I eat?', 'The resort kitchen serves local and international dishes, and there are small eateries around San Vicente. Tell me what you are craving — seafood, Filipino, or casual — and I will point you somewhere good.', 'food, eat, restaurant, seafood, Filipino, kitchen', true, 50),
  ('events', 'What is there to do in the evening?', 'Beach bonfires and community events pop up around town, especially in season. Long Beach sunsets and a quiet dinner are always a win. Ask Reception what is on this week.', 'events, bonfire, evening, night, community', true, 60),
  ('help', 'Can you make a booking or request for me?', 'I am a voice guide, so I cannot complete bookings myself. For rooms, tours, transport, towels, or anything that needs staff, Reception handles it — I will tell you exactly what to ask.', 'booking, request, reservation, reception, help', true, 70),
  ('help', 'What if there is an emergency?', 'For anything urgent or a safety issue, go straight to Reception or on-site staff right away. Do not wait on me for emergencies.', 'emergency, urgent, safety, medical, help', true, 71),
  ('tone', 'How should TALA talk?', 'Keep replies warm, concise, and practical — under three sentences unless asked for detail. Be a friendly local guide, never a robot.', 'tone, style, how you talk, concise', true, 90)
ON CONFLICT DO NOTHING;

-- Default config row (key is filled in via admin or SQL UPDATE — see README note).
INSERT INTO public.ai_assistant_config (id, active_provider, primary_model, temperature, guest_max_tokens)
VALUES ('default', 'openrouter', 'openrouter/auto', 0.7, 200)
ON CONFLICT (id) DO NOTHING;
