import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDograhWidget } from '../hooks/useDograhWidget';
import IslandMap from './IslandMap';
import {
  Mic,
  MicOff,
  Pause,
  Keyboard,
  Image as ImageIcon,
  MapPin,
  Headphones,
  Map,
  Users,
  Sparkles,
  Compass,
  User,
  ChevronRight,
  Star,
  Clock,
  Navigation,
  Heart,
  Share2,
  Volume2,
  Send,
  MoreHorizontal,
  Sun,
  Palmtree,
  Utensils,
  Sunset,
  Bus,
  Handshake,
  Hotel,
  PartyPopper,
  Bike,
  X,
  Check,
  UserPlus,
  Phone,
  Plus,
  Minus,
  Search,
  BookOpen,
} from 'lucide-react';

/* ============================================================
   TALA — SanVic.ph AI Voice Concierge
   Reactive mock backend · typed · localStorage-persisted
   ============================================================ */

/* ---------- Domain Types ---------- */
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

type BusinessCard = {
  id: string;
  name: string;
  tag: string;
  rating: number;
  reviewCount: number;
  distance: string;
  price: string;
  image: string;
  open: string;
  category: 'food' | 'tour' | 'stay' | 'transport' | 'event' | 'beach';
  description?: string;
};

type LocationPin = {
  id: string;
  name: string;
  distance: string;
  meta: string;
  category: 'beach' | 'sunset' | 'viewpoint' | 'town';
};

type MessageKind = 'text' | 'image' | 'location' | 'business' | 'system';

type Message = {
  id: string;
  role: 'tala' | 'user' | 'system';
  kind: MessageKind;
  text?: string;
  image?: string;
  location?: LocationPin;
  business?: BusinessCard;
  time: string;
  reservationId?: string;
};

type Reservation = {
  id: string;
  businessId: string;
  businessName: string;
  partySize: number;
  time: string;
  date: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  guestName: string;
  contact: string;
  notes?: string;
};

type NavKey = 'map' | 'community' | 'tala' | 'experiences' | 'profile';
type QuickActionKey = 'island' | 'food' | 'sunset' | 'transport' | 'travelers' | 'stay' | 'tonight' | 'scooter';

/* ---------- Local Storage Hook ---------- */
function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch { /* ignore */ }
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* ignore */ }
  }, [key, state]);
  return [state, setState];
}

/* ---------- Mock Database ---------- */
const MOCK_BUSINESSES: Record<QuickActionKey, BusinessCard[]> = {
  island: [
    { id: 'biz-lakawon', name: 'Lakawon & the Seven Islands', tag: 'Boat Tour · Group Charter', rating: 4.9, reviewCount: 212, distance: '12 min from you', price: '₱1,450 / seat', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70', open: 'Departs 9:00 AM', category: 'tour', description: 'Traditional outrigger visiting 7 islands — snorkel, cliff-jump, and a beach lunch on a sandbar.' },
    { id: 'biz-port-barton', name: 'Port Barton Island Hop', tag: 'Small Group · Max 6 pax', rating: 4.8, reviewCount: 147, distance: '18 min drive', price: '₱1,200 / seat', image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=900&q=70', open: 'Departs 8:30 AM', category: 'tour', description: 'A quieter route north with hidden lagoons and fewer boats.' },
  ],
  food: [
    { id: 'biz-kuya-boy', name: "Kuya Boy's Seafood Grill", tag: 'Local Seafood · Beachfront', rating: 4.8, reviewCount: 533, distance: '800 m · 3 min walk', price: '₱380 avg meal', image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=70', open: 'Open now · until 11 PM', category: 'food', description: 'Fresh tuna. Cold coconut. Sunset tables.' },
    { id: 'biz-sunrise', name: 'Sunrise Café & Bakery', tag: 'Breakfast · Sourdough', rating: 4.7, reviewCount: 201, distance: '1.2 km · 5 min drive', price: '₱260 avg meal', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=70', open: 'Open now · 6 AM – 3 PM', category: 'food', description: 'Warm sourdough. Mango butter. Slow mornings.' },
  ],
  sunset: [
    { id: 'biz-cape', name: 'Cape San Vicente Sunset Cliff', tag: 'Viewpoint · No entrance fee', rating: 4.9, reviewCount: 318, distance: '3.2 km · 12 min drive', price: 'Free', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70', open: 'Golden hour 5:48 PM', category: 'beach', description: 'A 15-minute hike up. Locals gather with guitars and coconut wine.' },
  ],
  transport: [
    { id: 'biz-jeep', name: 'North Line Jeepney Schedule', tag: 'Public Transport · Daily', rating: 4.3, reviewCount: 88, distance: 'Departs town plaza', price: '₱45 / trip', image: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?auto=format&fit=crop&w=900&q=70', open: 'Next: 10:30 AM', category: 'transport', description: 'Runs hourly between San Vicente and Port Barton. Cash only.' },
  ],
  travelers: [
    { id: 'biz-group-hop', name: 'Island Hop Meet-up · Tomorrow', tag: '4 travelers · 2 spots open', rating: 4.9, reviewCount: 42, distance: 'Meet at Port Barton pier', price: '₱1,450 / seat', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=70', open: 'Departs 9:00 AM', category: 'event', description: 'Two from Germany, one from Seoul, a photographer from Cebu. Friendly vibe.' },
  ],
  stay: [
    { id: 'biz-palms', name: 'The Palms Alimanguan', tag: 'Boutique Resort · Beachfront', rating: 4.8, reviewCount: 264, distance: 'Your current stay', price: '₱4,800 / night', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=70', open: 'Check-in 2 PM', category: 'stay', description: 'Low-key luxury, outdoor bath, on-site restaurant.' },
  ],
  tonight: [
    { id: 'biz-bonfire', name: 'Full Moon Bonfire at Long Beach', tag: 'Community · Free · All welcome', rating: 4.7, reviewCount: 112, distance: '2.4 km · 8 min drive', price: 'Free', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=70', open: 'Starts 7:30 PM', category: 'event', description: 'Acoustic sets, fire dancers, bring-your-own-bottle. Meet at the north tower.' },
  ],
  scooter: [
    { id: 'biz-honda', name: "Kuya Jun's Scooter Rental", tag: 'Honda Click 125i · Full tank', rating: 4.6, reviewCount: 189, distance: '500 m · 2 min walk', price: '₱500 / day', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=70', open: 'Open now · 7 AM – 8 PM', category: 'transport', description: 'Deposit: one ID + ₱1,000. Includes helmets. Free pickup from your resort.' },
  ],
};

const MOCK_LOCATIONS: Partial<Record<QuickActionKey, LocationPin[]>> = {
  sunset: [{ id: 'pin-cape', name: 'Cape San Vicente Sunset Cliff', distance: '3.2 km · 12 min drive', meta: 'Quiet · Ocean view · Free access', category: 'viewpoint' }],
  island: [{ id: 'pin-port', name: 'Port Barton Pier — Meeting Point', distance: '18 km · 25 min drive', meta: 'Parking available · Boat departs 9 AM', category: 'town' }],
  food: [{ id: 'pin-kuya', name: "Kuya Boy's — Beachfront", distance: '800 m · 3 min walk', meta: 'Open-air · Family-run · Popular', category: 'town' }],
};

const SUGGESTED_PROMPTS: string[] = [
  'Who wants to go island hopping tomorrow?',
  'What is happening tonight?',
  'Best seafood nearby?',
  'Quiet beach recommendations',
  'Find me other travelers',
];

const SUGGESTION_RESPONSES: Record<string, { text: string; cards?: BusinessCard[]; location?: LocationPin }> = {
  'Who wants to go island hopping tomorrow?': {
    text: 'There are 4 travelers leaving Port Barton at 9 AM tomorrow — two from Germany, one from Seoul, and a solo photographer from Cebu. They have 2 spots open on a traditional outrigger. Want me to introduce you?',
    cards: [MOCK_BUSINESSES.travelers[0], MOCK_BUSINESSES.island[0]],
  },
  'What is happening tonight?': {
    text: "Three things on this evening's calendar. The full moon bonfire at Long Beach is the most loved — a small, local-run acoustic night. Starts 7:30 PM.",
    cards: [MOCK_BUSINESSES.tonight[0]],
  },
  'Best seafood nearby?': {
    text: "Kuya Boy's has the freshest grilled tuna tail tonight — they just unloaded from the morning catch. 3-minute walk from your resort.",
    cards: [MOCK_BUSINESSES.food[0]],
    location: MOCK_LOCATIONS.food?.[0],
  },
  'Quiet beach recommendations': {
    text: 'Alimanguan beach, 5 minutes north. Hardly anyone there after 4 PM — perfect for a book and a cold coconut.',
    location: { id: 'pin-alimanguan', name: 'Alimanguan Quiet Beach', distance: '2.1 km · 6 min drive', meta: 'Quiet · Shallow water · Palms shade', category: 'beach' },
  },
  'Find me other travelers': {
    text: "Eleven solo travelers checked in today — mostly heading to Port Barton this week. I'll surface the 3 most relevant groups in the Community tab.",
    cards: [MOCK_BUSINESSES.travelers[0]],
  },
};

const QUICK_ACTIONS: { key: QuickActionKey; label: string; icon: typeof Palmtree; accent: string }[] = [
  { key: 'island', label: 'Island Hopping', icon: Palmtree, accent: '#435947' },
  { key: 'food', label: 'Food', icon: Utensils, accent: '#BA6A43' },
  { key: 'sunset', label: 'Sunset Spots', icon: Sunset, accent: '#BA6A43' },
  { key: 'transport', label: 'Transport', icon: Bus, accent: '#1C3A4A' },
  { key: 'travelers', label: 'Meet Travelers', icon: Handshake, accent: '#435947' },
  { key: 'stay', label: 'Accommodations', icon: Hotel, accent: '#BA6A43' },
  { key: 'tonight', label: 'Tonight', icon: PartyPopper, accent: '#BA6A43' },
  { key: 'scooter', label: 'Scooter Rental', icon: Bike, accent: '#1C3A4A' },
];

/* ---------- Suggested by TALA (contextual recommendation cards) ---------- */
const TALA_SUGGESTIONS: { emoji: string; title: string; subtitle: string; query: string | null; key: QuickActionKey | null; soon?: boolean }[] = [
  { emoji: '🌅', title: 'Best Sunset Tonight', subtitle: '8 travelers interested', query: 'Where should I watch the sunset tonight?', key: 'sunset' },
  { emoji: '🏝', title: 'Island Hop Tomorrow', subtitle: 'Boat leaves 8:30 AM', query: 'Who wants to go island hopping tomorrow?', key: 'island' },
  { emoji: '🍤', title: 'Seafood Nearby', subtitle: '4 minute ride', query: 'Best seafood nearby?', key: 'food' },
  { emoji: '👥', title: 'Meet Travelers', subtitle: '12 currently online', query: 'Find me other travelers', key: 'travelers' },
  { emoji: '🛵', title: 'El Nido Luxury Shuttle', subtitle: 'Launching soon', query: null, key: null, soon: true },
];

/* ---------- People are asking TALA ---------- */
const ASKING_PROMPTS: string[] = [
  'Who wants to go island hopping tomorrow?',
  'Best seafood tonight?',
  'Quiet beach recommendations?',
  'Romantic dinner suggestions?',
  'Can I surf this week?',
  'How do I get to El Nido?',
];



const INITIAL_MESSAGES: Message[] = [
  { id: 'm1', role: 'tala', kind: 'text', text: "Good morning, Marco. I see you're staying at The Palms in Alimanguan. Three beautiful days ahead — low tide at 8:30 AM. How can I help?", time: '9:02 AM' },
  { id: 'm2', role: 'user', kind: 'text', text: 'I want to go island hopping tomorrow with a few people. Any groups forming?', time: '9:03 AM' },
  { id: 'm3', role: 'tala', kind: 'text', text: 'There are 4 travelers leaving Port Barton at 9 AM tomorrow — two from Germany, one from Seoul, and a solo photographer from Cebu. They have 2 spots open on a traditional outrigger. Want me to introduce you?', time: '9:03 AM' },
  { id: 'm4', role: 'tala', kind: 'business', business: MOCK_BUSINESSES.travelers[0], time: '9:03 AM' },
  { id: 'm5', role: 'user', kind: 'text', text: 'Perfect. And where should we watch the sunset tonight?', time: '9:04 AM' },
  { id: 'm6', role: 'tala', kind: 'text', text: "The cliff at Cape San Vicente is clearing up beautifully — golden hour at 5:48 PM. There's a small gathering of travelers bringing guitars and coconut wine. Want a pin?", time: '9:04 AM' },
  { id: 'm7', role: 'tala', kind: 'location', location: MOCK_LOCATIONS.sunset?.[0], time: '9:04 AM' },
  { id: 'm8', role: 'user', kind: 'text', text: 'Seafood dinner nearby after?', time: '9:05 AM' },
  { id: 'm9', role: 'tala', kind: 'text', text: "Three places the locals love this week. Kuya Boy's has the freshest grilled tuna tail tonight — they just unloaded from the morning catch.", time: '9:05 AM' },
  { id: 'm10', role: 'tala', kind: 'business', business: MOCK_BUSINESSES.food[0], time: '9:05 AM' },
];

/* ---------- Helpers ---------- */
const nowTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* ============================================================
   UI Sub-components
   ============================================================ */

function VoiceOrb({ state, onClick }: { state: VoiceState; onClick: () => void }) {
  const active = state !== 'idle';
  const coreBg =
    state === 'speaking'
      ? 'radial-gradient(circle at 32% 26%, #FFFDF8 0%, #F2ECDF 36%, #E3D6C1 70%, #C9B896 100%)'
      : state === 'listening'
      ? 'radial-gradient(circle at 32% 26%, #FFFDF8 0%, #F6EFE1 42%, #E9E2D7 74%, #D7CAAB 100%)'
      : state === 'thinking'
      ? 'radial-gradient(circle at 32% 26%, #F6EFE1 0%, #E9E2D7 42%, #D7CAAB 74%, #C98B65 100%)'
      : 'radial-gradient(circle at 32% 26%, #FAF5EB 0%, #EFE4D0 46%, #E3D6C1 78%, #D7CAAB 100%)';
  return (
    <button onClick={onClick} className="relative flex h-60 w-60 items-center justify-center outline-none" aria-label={`TALA voice orb, ${state}`}>
      {/* soft sandstone ambient glow */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[#D7CAAB]/50 blur-3xl orb-glow" />
      {/* breathing pulse rings */}
      <span className={`absolute inset-2 rounded-full bg-[#D7CAAB]/25 ${active ? 'ring-pulse' : ''}`} />
      <span className={`absolute inset-6 rounded-full bg-[#EFE4D0]/40 ${active ? 'ring-pulse-2' : ''}`} />
      {/* glass halo */}
      <span className="absolute inset-7 rounded-full bg-gradient-to-b from-white/50 to-transparent" />
      <div
        className={`relative flex h-40 w-40 items-center justify-center rounded-full orb-breathe ${state === 'thinking' ? 'animate-pulse' : ''}`}
        style={{ background: coreBg, boxShadow: 'inset 0 3px 12px rgba(255,255,255,0.75), inset 0 -16px 34px rgba(120,90,60,0.16), 0 28px 70px -22px rgba(60,45,30,0.40)' }}
      >
        <span className="absolute left-7 top-6 h-12 w-12 rounded-full bg-white/70 blur-lg" />
        <div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#FFFDF8]/90 shadow-inner backdrop-blur-sm">
          {state === 'idle' ? <Mic className="h-7 w-7 text-[#BFA984]" /> : <div className="font-serif-display text-[42px] leading-none text-[#2A2420]">T</div>}
        </div>
      </div>
    </button>
  );
}

function Waveform({ state, onClick }: { state: VoiceState; onClick: () => void }) {
  const bars = state === 'speaking' ? 13 : state === 'listening' ? 11 : state === 'thinking' ? 7 : 5;
  const heights = state === 'idle' ? [4, 4, 4, 4, 4] : Array.from({ length: bars }, (_, i) => 8 + ((i * 37) % 22));
  return (
    <button onClick={onClick} className="flex h-8 w-full items-end justify-center gap-[3px]" aria-label="Toggle voice">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`wave-bar w-[3px] rounded-full ${state === 'idle' ? 'bg-[#D7CAAB]' : 'bg-[#BFA984]'}`}
          style={{ height: `${h + 8}px`, animationDelay: `${(i % 7) * 0.08}s`, opacity: state === 'idle' ? 0.5 : 1, animationPlayState: state === 'idle' ? 'paused' : 'running' }}
        />
      ))}
    </button>
  );
}

function StatusLabel({ state }: { state: VoiceState }) {
  const map = {
    speaking: { label: 'Speaking…', hint: 'Tap orb to end call' },
    listening: { label: 'Listening…', hint: 'Say something naturally' },
    thinking: { label: 'Thinking…', hint: 'TALA is putting together a reply' },
    idle: { label: 'Tap to start', hint: 'Tap anywhere on the orb to begin' },
  } as const;
  const s = map[state];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {state !== 'idle' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#BA6A43] opacity-60" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${state === 'idle' ? 'bg-[#8A7E6E]' : 'bg-[#BA6A43]'}`} />
        </span>
        <span className="font-serif-display text-[22px] text-[#2A2420]">{s.label}</span>
      </div>
      <span className="text-[12px] text-[#8A7E6E]">{s.hint}</span>
    </div>
  );
}

function BusinessCardView({ biz, onReserve, onFavorite, favorite, reservation }: { biz: BusinessCard; onReserve: (b: BusinessCard) => void; onFavorite: (id: string) => void; favorite: boolean; reservation?: Reservation }) {
  const confirmed = reservation?.status === 'confirmed';
  return (
    <div className="overflow-hidden rounded-[24px] bg-[#FFFDF8] shadow-card">
      {/* Edge-to-edge hero photo */}
      <div className="relative h-52 w-full overflow-hidden">
        <img src={biz.image} alt={biz.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2A2420]/70 via-transparent to-transparent" />
        <button onClick={() => onFavorite(biz.id)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#2A2420] shadow-soft backdrop-blur-sm">
          <Heart className={`h-4 w-4 ${favorite ? 'fill-[#BA6A43] text-[#BA6A43]' : ''}`} />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="font-serif-display text-[22px] leading-tight text-[#FFFDF8] drop-shadow-sm">{biz.name}</div>
          <div className="mt-0.5 text-[12px] text-[#FFFDF8]/80">{biz.tag}</div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {biz.description && <p className="font-serif-display text-[17px] leading-snug text-[#2A2420]">{biz.description}</p>}
        <div className="flex items-center gap-2 text-[12px] text-[#8A7E6E]">
          <Clock className="h-3.5 w-3.5" /><span>{biz.open}</span>
          <span className="text-[#D7CAAB]">·</span>
          <span>{biz.distance}</span>
          <span className="ml-auto font-medium text-[#435947]">{biz.price}</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={() => onReserve(biz)}
            className={`flex-1 rounded-full py-3 text-[12.5px] font-medium ${confirmed ? 'bg-[#435947] text-[#FAF5EB]' : 'bg-[#2A2420] text-[#FAF5EB]'}`}
          >
            {confirmed ? <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Confirmed · {reservation?.time}</span> : 'Reserve'}
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2ECDF] text-[#5A4F44]"><Navigation className="h-4 w-4" /></button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2ECDF] text-[#5A4F44]"><Share2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function LocationCardView({ l }: { l: LocationPin }) {
  return (
    <div className="overflow-hidden rounded-[24px] bg-[#FFFDF8] shadow-soft">
      <div className="map-bg relative h-28 w-full">
        <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 400 160" fill="none">
          <path d="M0 110 Q 80 60 160 90 T 400 70" stroke="#6B8068" strokeWidth="1.5" fill="none" opacity="0.55" />
          <path d="M0 130 Q 100 100 200 120 T 400 110" stroke="#BA6A43" strokeWidth="1" fill="none" opacity="0.4" strokeDasharray="3 4" />
          <circle cx="210" cy="80" r="6" fill="#BA6A43" />
          <circle cx="210" cy="80" r="14" fill="#BA6A43" opacity="0.18" />
        </svg>
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#2A2420] shadow-soft">
          <MapPin className="mr-1 inline h-3 w-3 text-[#BA6A43]" /> Saved Pin
        </div>
      </div>
      <div className="space-y-1 p-4">
        <div className="font-serif-display text-[17px] leading-tight text-[#2A2420]">{l.name}</div>
        <div className="text-[12px] text-[#5A4F44]">{l.meta}</div>
        <div className="flex items-center justify-between pt-2 text-[12px]">
          <span className="text-[#8A7E6E]">{l.distance}</span>
          <button className="flex items-center gap-1 font-medium text-[#435947]">Open in map <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, onReserve, onFavorite, favorites, reservations }: { m: Message; onReserve: (b: BusinessCard) => void; onFavorite: (id: string) => void; favorites: Set<string>; reservations: Record<string, Reservation> }) {
  const isTala = m.role === 'tala';
  const isSystem = m.role === 'system';
  return (
    <div className={`fade-up flex w-full flex-col gap-1.5 ${isSystem ? 'items-center' : isTala ? 'items-start' : 'items-end'}`}>
      {isSystem ? (
        <div className="my-1 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] text-[#8A7E6E]">
          <span className="h-px w-8 bg-[#D7CAAB]" />{m.text}<span className="h-px w-8 bg-[#D7CAAB]" />
        </div>
      ) : (
        <div className="max-w-[88%]">
          {m.kind === 'text' && (
            <div className={`rounded-[22px] px-4 py-3 text-[14.5px] leading-relaxed shadow-soft ${isTala ? 'rounded-tl-md bg-[#FAF5EB] text-[#2A2420]' : 'rounded-tr-md bg-[#D7CAAB] text-[#2A2420]'}`}>
              {m.text}
            </div>
          )}
          {m.kind === 'image' && m.image && (
            <div className="overflow-hidden rounded-[22px] shadow-soft"><img src={m.image} alt="upload" className="h-48 w-full object-cover" /></div>
          )}
          {m.kind === 'business' && m.business && (
            <BusinessCardView biz={m.business} onReserve={onReserve} onFavorite={onFavorite} favorite={favorites.has(m.business.id)} reservation={reservations[m.business.id]} />
          )}
          {m.kind === 'location' && m.location && <LocationCardView l={m.location} />}
          <div className={`mt-1 flex items-center gap-1.5 text-[11px] text-[#8A7E6E] ${isTala ? 'justify-start pl-1' : 'justify-end pr-1'}`}>
            {isTala && <Volume2 className="h-3 w-3" />}<span>{m.time}</span>{isTala && <span>· TALA</span>}
          </div>
        </div>
      )}
    <