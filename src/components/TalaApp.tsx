import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDograhWidget } from '../hooks/useDograhWidget';
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
    { id: 'biz-kuya-boy', name: "Kuya Boy's Seafood Grill", tag: 'Local Seafood · Beachfront', rating: 4.8, reviewCount: 533, distance: '800 m · 3 min walk', price: '₱380 avg meal', image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=70', open: 'Open now · until 11 PM', category: 'food', description: 'Grilled tuna tail, kinilaw, and cold coconut. Cash preferred.' },
    { id: 'biz-sunrise', name: 'Sunrise Café & Bakery', tag: 'Breakfast · Sourdough', rating: 4.7, reviewCount: 201, distance: '1.2 km · 5 min drive', price: '₱260 avg meal', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=70', open: 'Open now · 6 AM – 3 PM', category: 'food', description: 'The only real sourdough on the coast. Try the mango butter.' },
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
      ? 'radial-gradient(circle at 30% 28%, #FAF5EB 0%, #EFE4D0 38%, #D7CAAB 72%, #BFA984 100%)'
      : state === 'listening'
      ? 'radial-gradient(circle at 30% 28%, #FAF5EB 0%, #F2ECDF 40%, #E3D6C1 72%, #D7CAAB 100%)'
      : state === 'thinking'
      ? 'radial-gradient(circle at 30% 28%, #F2ECDF 0%, #E3D6C1 42%, #C9B896 76%, #BA6A43 100%)'
      : 'radial-gradient(circle at 30% 28%, #F6EFE1 0%, #E9E2D7 45%, #D7CAAB 80%, #BFA984 100%)';
  return (
    <button onClick={onClick} className="relative flex h-52 w-52 items-center justify-center outline-none" aria-label={`TALA voice orb, ${state}`}>
      <span className={`absolute inset-0 rounded-full bg-[#D7CAAB]/40 ${active ? 'ring-pulse' : ''}`} />
      <span className={`absolute inset-4 rounded-full bg-[#EFE4D0]/60 ${active ? 'ring-pulse-2' : ''}`} />
      <div
        className={`relative flex h-32 w-32 items-center justify-center rounded-full ${active ? 'orb-breathe' : ''} ${state === 'thinking' ? 'animate-pulse' : ''}`}
        style={{ background: coreBg, boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.6), inset 0 -10px 24px rgba(120,90,60,0.18), 0 20px 50px -18px rgba(60,45,30,0.35)' }}
      >
        <span className="absolute left-5 top-4 h-9 w-9 rounded-full bg-white/60 blur-md" />
        <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#FAF5EB] shadow-inner">
          {state === 'idle' ? <Pause className="h-7 w-7 text-[#8A7E6E]" /> : <div className="font-serif-display text-[34px] leading-none text-[#2A2420]">T</div>}
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
    <div className="overflow-hidden rounded-[22px] border hairline bg-white shadow-soft">
      <div className="relative h-36 w-full overflow-hidden">
        <img src={biz.image} alt={biz.name} className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#2A2420] shadow-soft">
          <Star className="h-3 w-3 fill-[#BA6A43] text-[#BA6A43]" />
          <span>{biz.rating} <span className="text-[#8A7E6E]">({biz.reviewCount})</span></span>
          <span className="text-[#8A7E6E]">· {biz.distance}</span>
        </div>
        <button onClick={() => onFavorite(biz.id)} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#2A2420] shadow-soft">
          <Heart className={`h-4 w-4 ${favorite ? 'fill-[#BA6A43] text-[#BA6A43]' : ''}`} />
        </button>
      </div>
      <div className="space-y-2 p-4">
        <div>
          <div className="font-serif-display text-[18px] leading-tight text-[#2A2420]">{biz.name}</div>
          <div className="text-[12px] text-[#8A7E6E]">{biz.tag}</div>
          {biz.description && <p className="mt-1.5 text-[12.5px] leading-snug text-[#5A4F44]">{biz.description}</p>}
        </div>
        <div className="flex items-center justify-between border-t hairline pt-3 text-[12px]">
          <span className="flex items-center gap-1 text-[#5A4F44]"><Clock className="h-3.5 w-3.5 text-[#8A7E6E]" />{biz.open}</span>
          <span className="font-medium text-[#435947]">{biz.price}</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onReserve(biz)}
            className={`flex-1 rounded-full py-2.5 text-[12px] font-medium ${confirmed ? 'bg-[#435947] text-[#FAF5EB]' : 'bg-[#2A2420] text-[#FAF5EB]'}`}
          >
            {confirmed ? <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Confirmed · {reservation?.time}</span> : 'Reserve'}
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[#5A4F44]"><Navigation className="h-4 w-4" /></button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[#5A4F44]"><Share2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function LocationCardView({ l }: { l: LocationPin }) {
  return (
    <div className="overflow-hidden rounded-[22px] border hairline bg-white shadow-soft">
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
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="fade-up flex items-start gap-2">
      <div className="rounded-[22px] rounded-tl-md bg-[#FAF5EB] px-4 py-3.5 shadow-soft">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8A7E6E]" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8A7E6E]" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8A7E6E]" />
        </div>
      </div>
    </div>
  );
}

function ReservationModal({ open, onClose, business, onConfirm }: { open: boolean; onClose: () => void; business: BusinessCard | null; onConfirm: (r: Reservation) => void }) {
  const [party, setParty] = useState(2);
  const [time, setTime] = useState('7:00 PM');
  const [name, setName] = useState('Marco Reyes');
  const [contact, setContact] = useState('+63 917 000 0000');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) { setParty(2); setTime('7:00 PM'); setNotes(''); } }, [open]);
  if (!open || !business) return null;
  const times = ['5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM'];
  const confirm = () => {
    const r: Reservation = { id: uid('res'), businessId: business.id, businessName: business.name, partySize: party, time, date: new Date().toISOString().slice(0, 10), status: 'confirmed', guestName: name, contact, notes: notes || undefined };
    onConfirm(r);
  };
  return (
    <div className="fade-up fixed inset-0 z-50 flex items-end justify-center bg-[#2A2420]/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[430px] rounded-t-[32px] bg-[#FAF5EB] p-5 pb-7 shadow-luxe sm:rounded-[32px]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D7CAAB]" />
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-[#8A7E6E]">New reservation</div>
            <div className="font-serif-display text-[24px] leading-tight text-[#2A2420]">{business.name}</div>
            <div className="text-[12px] text-[#8A7E6E]">{business.tag}</div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white text-[#5A4F44]"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 rounded-[22px] border hairline bg-white p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between text-[12px] text-[#8A7E6E]">
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Party size</span>
            <span className="font-medium text-[#2A2420]">{party} {party === 1 ? 'guest' : 'guests'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setParty((p) => Math.max(1, p - 1))} className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[#2A2420]"><Minus className="h-4 w-4" /></button>
            <div className="flex-1 text-center font-serif-display text-[22px] text-[#2A2420]">{party}</div>
            <button onClick={() => setParty((p) => Math.min(12, p + 1))} className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[#2A2420]"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mb-3 rounded-[22px] border hairline bg-white p-4 shadow-soft">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] text-[#8A7E6E]"><Clock className="h-3.5 w-3.5" /> Time · Tonight</div>
          <div className="flex flex-wrap gap-2">
            {times.map((t) => (
              <button key={t} onClick={() => setTime(t)} className={`rounded-full px-3 py-1.5 text-[12px] ${time === t ? 'bg-[#2A2420] text-[#FAF5EB]' : 'border hairline bg-[#F2ECDF] text-[#2A2420]'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="mb-3 space-y-2 rounded-[22px] border hairline bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-[#8A7E6E]" /><input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 bg-transparent text-[13px] text-[#2A2420] placeholder:text-[#8A7E6E] focus:outline-none" placeholder="Guest name" /></div>
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#8A7E6E]" /><input value={contact} onChange={(e) => setContact(e.target.value)} className="flex-1 bg-transparent text-[13px] text-[#2A2420] placeholder:text-[#8A7E6E] focus:outline-none" placeholder="Contact number" /></div>
          <div className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5 text-[#8A7E6E]" /><input value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1 bg-transparent text-[13px] text-[#2A2420] placeholder:text-[#8A7E6E] focus:outline-none" placeholder="Notes (optional)" /></div>
        </div>
        <button onClick={confirm} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2A2420] py-3.5 text-[14px] font-medium text-[#FAF5EB] shadow-card"><Check className="h-4 w-4" />Confirm reservation · {time}</button>
        <div className="mt-2 text-center text-[11px] text-[#8A7E6E]">You can cancel anytime from your Profile tab.</div>
      </div>
    </div>
  );
}

function TabPanel({ tab, onClose, reservations, favorites, favoriteBusinesses }: { tab: NavKey; onClose: () => void; reservations: Reservation[]; favorites: Set<string>; favoriteBusinesses: BusinessCard[] }) {
  const titleMap = { map: 'Island Map', community: 'Community', experiences: 'Experiences', profile: 'Your Profile', tala: '' };
  const headingMap = { map: 'Every pin, every path.', community: 'Meet the island today.', experiences: 'Curated by locals.', profile: 'Welcome back, Marco.', tala: '' };
  return (
    <div className="fade-up flex flex-col">
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-[#8A7E6E]">{titleMap[tab]}</div>
          <div className="font-serif-display text-[26px] leading-tight text-[#2A2420]">{headingMap[tab]}</div>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white text-[#5A4F44] shadow-soft"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-5 pb-5">
        {tab === 'map' && (
          <div className="space-y-3">
            <div className="map-bg relative h-64 w-full overflow-hidden rounded-[24px] border hairline shadow-card">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 260" fill="none">
                <path d="M0 170 Q 80 110 180 140 T 400 110" stroke="#6B8068" strokeWidth="2" fill="none" opacity="0.55" />
                <path d="M0 210 Q 120 170 220 190 T 400 170" stroke="#BA6A43" strokeWidth="1.3" fill="none" opacity="0.5" strokeDasharray="4 5" />
                {[{ x: 80, y: 150 }, { x: 220, y: 120 }, { x: 310, y: 160 }, { x: 160, y: 200 }].map((p, i) => (
                  <g key={i}><circle cx={p.x} cy={p.y} r="12" fill="#BA6A43" opacity="0.18" /><circle cx={p.x} cy={p.y} r="5" fill="#BA6A43" /></g>
                ))}
              </svg>
              <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#2A2420] shadow-soft"><MapPin className="mr-1 inline h-3 w-3 text-[#BA6A43]" /> 12 pins nearby</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">{['Beaches', 'Food', 'Sunset', 'Transport', 'Stay', 'Events'].map((c) => (<div key={c} className="rounded-[20px] border hairline bg-white p-3 text-[13px] text-[#2A2420] shadow-soft">{c}</div>))}</div>
          </div>
        )}
        {tab === 'community' && (
          <div className="space-y-3">
            {[
              { name: 'Lina & Kai', from: 'Seoul, KR', doing: 'Island hop tomorrow', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=70' },
              { name: 'Tobias', from: 'Berlin, DE', doing: 'Looking for scooter buddy', img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=70' },
              { name: 'Aya & Kenji', from: 'Cebu, PH', doing: 'Bonfire tonight', img: 'https://images.unsplash.com/photo-1502767089025-6572583495b4?auto=format&fit=crop&w=400&q=70' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[22px] border hairline bg-white p-3 shadow-soft">
                <img src={p.img} className="h-12 w-12 rounded-full object-cover" alt={p.name} />
                <div className="flex-1"><div className="text-[14px] font-medium text-[#2A2420]">{p.name}</div><div className="text-[11.5px] text-[#8A7E6E]">{p.from} · {p.doing}</div></div>
                <button className="flex items-center gap-1 rounded-full bg-[#F2ECDF] px-3 py-1.5 text-[12px] text-[#2A2420]"><UserPlus className="h-3.5 w-3.5" /> Say hi</button>
              </div>
            ))}
          </div>
        )}
        {tab === 'experiences' && (
          <div className="space-y-3">
            {MOCK_BUSINESSES.island.concat(MOCK_BUSINESSES.tonight).map((e) => (
              <div key={e.id} className="overflow-hidden rounded-[22px] border hairline bg-white shadow-soft">
                <img src={e.image} className="h-32 w-full object-cover" alt={e.name} />
                <div className="p-3"><div className="font-serif-display text-[17px] text-[#2A2420]">{e.name}</div><div className="text-[12px] text-[#8A7E6E]">{e.tag} · {e.price}</div></div>
              </div>
            ))}
          </div>
        )}
        {tab === 'profile' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-[22px] border hairline bg-white p-4 shadow-soft">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F2ECDF] font-serif-display text-[24px] text-[#2A2420]">MR</div>
              <div className="flex-1"><div className="font-serif-display text-[20px] text-[#2A2420]">Marco Reyes</div><div className="text-[12px] text-[#8A7E6E]">Manila · Member since 2024</div></div>
              <Heart className="h-5 w-5 text-[#BA6A43]" />
            </div>
            <div className="rounded-[22px] border hairline bg-white p-4 shadow-soft">
              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-[#8A7E6E]">Upcoming ({reservations.length})</div>
              {reservations.length === 0 ? <div className="text-[13px] text-[#8A7E6E]">No reservations yet. Try Kuya Boy's tonight.</div> : reservations.map((r) => (<div key={r.id} className="flex items-center justify-between border-t hairline py-2 first:border-none"><div><div className="text-[13.5px] text-[#2A2420]">{r.businessName}</div><div className="text-[11.5px] text-[#8A7E6E]">{r.time} · {r.partySize} guests</div></div><span className="rounded-full bg-[#435947]/10 px-2 py-1 text-[11px] font-medium text-[#435947]">Confirmed</span></div>))}
            </div>
            <div className="rounded-[22px] border hairline bg-white p-4 shadow-soft">
              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-[#8A7E6E]">Favorites ({favorites.size})</div>
              {favoriteBusinesses.length === 0 ? <div className="text-[13px] text-[#8A7E6E]">Heart any card to save it here.</div> : favoriteBusinesses.map((b) => (<div key={b.id} className="flex items-center justify-between border-t hairline py-2 first:border-none"><div><div className="text-[13.5px] text-[#2A2420]">{b.name}</div><div className="text-[11.5px] text-[#8A7E6E]">{b.tag}</div></div><Star className="h-4 w-4 fill-[#BA6A43] text-[#BA6A43]" /></div>))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [messages, setMessages] = useLocalState<Message[]>('tala:messages', INITIAL_MESSAGES);
  const [favorites, setFavorites] = useLocalState<string[]>('tala:favorites', []);
  const [reservations, setReservations] = useLocalState<Reservation[]>('tala:reservations', []);
  const [activeNav, setActiveNav] = useLocalState<NavKey>('tala:nav', 'tala');
  const [input, setInput] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [reserveTarget, setReserveTarget] = useState<BusinessCard | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const reservationByBiz = useMemo(() => {
    const map: Record<string, Reservation> = {};
    reservations.forEach((r) => { if (r.status === 'confirmed') map[r.businessId] = r; });
    return map;
  }, [reservations]);
  const favoriteBusinesses = useMemo(() => {
    const all: BusinessCard[] = Object.values(MOCK_BUSINESSES).flat();
    return all.filter((b) => favoriteSet.has(b.id));
  }, [favoriteSet]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2400); return () => clearTimeout(id); }, [toast]);

  const appendMessage = useCallback((m: Omit<Message, 'id' | 'time'> & { time?: string }) => {
    setMessages((prev) => [...prev, { ...m, id: uid('msg'), time: m.time ?? nowTime() }]);
  }, [setMessages]);

  const {
    voiceState,
    isConnecting,
    errorMessage: voiceError,
    start: startVoiceCall,
    stop: stopVoiceCall,
  } = useDograhWidget();

  const handleMicTap = useCallback(() => {
    if (voiceState === 'idle') {
      startVoiceCall();
    } else {
      stopVoiceCall();
    }
  }, [voiceState, startVoiceCall, stopVoiceCall]);

  useEffect(() => { if (voiceError) setToast(voiceError); }, [voiceError]);


  const appendUserText = useCallback((text: string) => appendMessage({ role: 'user', kind: 'text', text }), [appendMessage]);

  const runQuery = useCallback((userText: string, key: QuickActionKey | null, custom?: { text?: string; cards?: BusinessCard[]; location?: LocationPin }) => {
    setIsTyping(true);
    const latency = 600 + Math.floor(Math.random() * 500);
    setTimeout(() => {
      setIsTyping(false);
      const intro = custom?.text ?? `Here's the best match I found for "${userText}". Locals love it this week —`;
      appendMessage({ role: 'tala', kind: 'text', text: intro });
      if (custom?.cards && custom.cards.length > 0) {
        custom.cards.forEach((b) => appendMessage({ role: 'tala', kind: 'business', business: b }));
      } else if (key) {
        (MOCK_BUSINESSES[key] ?? []).slice(0, 2).forEach((b) => appendMessage({ role: 'tala', kind: 'business', business: b }));
      }
      if (custom?.location) appendMessage({ role: 'tala', kind: 'location', location: custom.location });
      else if (key && MOCK_LOCATIONS[key]) {
        (MOCK_LOCATIONS[key] ?? []).slice(0, 1).forEach((l) => appendMessage({ role: 'tala', kind: 'location', location: l }));
      }
    }, latency);
  }, [appendMessage]);

  const handleQuickAction = useCallback((key: QuickActionKey, label: string) => {
    appendMessage({ role: 'system', kind: 'text', text: `Filter: ${label}` });
    appendUserText(`Show me ${label.toLowerCase()}`);
    runQuery(label, key);
  }, [appendMessage, appendUserText, runQuery]);

  const handleSuggestion = useCallback((prompt: string) => {
    appendUserText(prompt);
    const response = SUGGESTION_RESPONSES[prompt];
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      if (response) {
        appendMessage({ role: 'tala', kind: 'text', text: response.text });
        (response.cards ?? []).forEach((b) => appendMessage({ role: 'tala', kind: 'business', business: b }));
        if (response.location) appendMessage({ role: 'tala', kind: 'location', location: response.location });
      } else {
        runQuery(prompt, null, { text: "Great question. Here's what I'd recommend based on what's open right now." });
      }
    }, 700);
  }, [appendMessage, appendUserText, runQuery]);

  const sendMessage = useCallback((text: string) => {
    const t = text.trim(); if (!t) return;
    appendUserText(t); setInput(''); runQuery(t, null);
  }, [appendUserText, runQuery]);

  const openReserve = (b: BusinessCard) => {
    if (reservationByBiz[b.id]) { setToast(`Already confirmed at ${b.name}`); return; }
    setReserveTarget(b);
  };
  const confirmReservation = (r: Reservation) => {
    setReservations((prev) => [...prev, r]);
    setReserveTarget(null);
    setToast(`✓ Confirmed · ${r.businessName} · ${r.time}`);
    appendMessage({ role: 'system', kind: 'text', text: 'Reservation update' });
    appendMessage({ role: 'tala', kind: 'text', text: `All set. Table for ${r.partySize} at ${r.businessName}, ${r.time} tonight. I've sent a pin to your SMS — see you there!` });
  };
  const toggleFavorite = (id: string) => setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const onNav = (k: NavKey) => setActiveNav(k);

  const showTala = activeNav === 'tala';

  return (
    <div className="min-h-screen w-full bg-[#EFE6D6] py-6">
      <div className="mx-auto flex max-w-[430px] flex-col overflow-hidden rounded-[44px] border border-[#D7CAAB]/60 bg-[#FAF5EB] shadow-luxe" style={{ minHeight: 932 }}>
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-1 text-[12px] font-medium text-[#2A2420]">
          <span>9:41</span>
          <div className="flex items-center gap-1.5 text-[#2A2420]">
            <span className="text-[11px]">San Vic</span>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M1 5 L4 2 L7 5 L10 2 L13 5 L15 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="13" height="7" rx="1.5" fill="currentColor" /><rect x="19.5" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5" /></svg>
          </div>
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-3 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white shadow-soft"><Sun className="h-4 w-4 text-[#BA6A43]" /></div>
            <div className="leading-tight">
              <div className="font-serif-display text-[15px] tracking-wide text-[#2A2420]">SANVIC<span className="text-[#BA6A43]">.ph</span></div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-[#8A7E6E]">{showTala ? 'Island Concierge' : 'San Vicente, Palawan'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white text-[#5A4F44] shadow-soft"><Search className="h-4 w-4" /></button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white text-[#5A4F44] shadow-soft"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        </header>

        {showTala && (
          <>
            <section className="px-6 pb-5">
              <div className="text-center">
                <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border hairline bg-white/70 px-3 py-1 text-[10.5px] uppercase tracking-[0.2em] text-[#8A7E6E]"><span className="h-1 w-1 rounded-full bg-[#BA6A43]" /> Your AI Island Assistant</div>
                <h1 className="font-serif-display text-[42px] leading-[1.02] text-[#2A2420]">Hi, I'm <span className="italic text-[#BA6A43]">TALA</span></h1>
                <p className="mt-1 text-[14px] text-[#5A4F44]">Your San Vicente Island Assistant</p>
              </div>
            </section>

            <section className="px-5 pb-4">
              <div className="paper-grain relative overflow-hidden rounded-[32px] border hairline bg-[#FAF5EB] p-6 pb-5 shadow-card">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#EFE4D0]/70" />
                <div className="pointer-events-none absolute -left-12 bottom-0 h-28 w-28 rounded-full bg-[#D7CAAB]/40" />
                <div className="relative flex flex-col items-center">
                  <VoiceOrb state={voiceState} onClick={handleMicTap} />
                  <div className="mt-3 w-full"><StatusLabel state={voiceState} /></div>
                  <div className="mt-4 w-full"><Waveform state={voiceState} onClick={handleMicTap} /></div>
                  <div className="mt-4 flex w-full items-center justify-center gap-2">
                    <button
                      onClick={handleMicTap}
                      disabled={isConnecting}
                      className={`rounded-full px-4 py-1.5 text-[11px] font-medium shadow-soft ${voiceState === 'idle' ? 'bg-[#2A2420] text-[#FAF5EB]' : 'border hairline bg-white text-[#5A4F44]'} ${isConnecting ? 'opacity-60' : ''}`}
                    >
                      {isConnecting ? 'Connecting…' : voiceState === 'idle' ? 'Start voice call' : 'End call'}
                    </button>
                  </div>
                </div>

              </div>
            </section>

            <section className="px-5 pb-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-[0.22em] text-[#8A7E6E]">Quick actions</span>
                <span className="text-[11px] text-[#8A7E6E]">8 categories</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button key={a.label} onClick={() => handleQuickAction(a.key, a.label)} className="chip group flex items-center gap-2.5 rounded-[20px] border hairline bg-white p-3 text-left shadow-soft">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${a.accent}14`, color: a.accent }}><Icon className="h-[18px] w-[18px]" /></span>
                      <div className="flex flex-1 items-center justify-between"><span className="text-[13px] font-medium text-[#2A2420]">{a.label}</span><ChevronRight className="h-3.5 w-3.5 text-[#8A7E6E]" /></div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="px-5 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="h-px w-6 bg-[#D7CAAB]" /><span className="text-[10.5px] uppercase tracking-[0.22em] text-[#8A7E6E]">Conversation</span><span className="h-px w-6 bg-[#D7CAAB]" /></div>
                <button onClick={() => setMessages(INITIAL_MESSAGES)} className="text-[11px] text-[#8A7E6E]">Reset</button>
              </div>
              <div ref={scrollRef} className="no-scrollbar flex max-h-[340px] flex-col gap-3 overflow-y-auto pr-1">
                {messages.map((m) => (<MessageBubble key={m.id} m={m} onReserve={openReserve} onFavorite={toggleFavorite} favorites={favoriteSet} reservations={reservationByBiz} />))}
                {isTyping && <TypingBubble />}
              </div>
            </section>

            <section className="px-5 pb-4">
              <div className="mb-2 flex items-center justify-between"><span className="text-[10.5px] uppercase tracking-[0.22em] text-[#8A7E6E]">Try asking TALA</span></div>
              <div className="flex flex-col gap-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button key={p} onClick={() => handleSuggestion(p)} className="chip flex items-start gap-3 rounded-[20px] border hairline bg-[#F2ECDF] p-3.5 text-left shadow-soft">
                    <span className="mt-0.5 font-serif-display text-[18px] leading-none text-[#BA6A43]">“</span>
                    <span className="flex-1 text-[13.5px] leading-snug text-[#2A2420]">{p}</span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#8A7E6E]" />
                  </button>
                ))}
              </div>
            </section>

            <section className="px-5 pb-4">
              <div className="flex items-center gap-2 rounded-[28px] border hairline bg-white p-2 shadow-card">
                <button onClick={() => setKeyboardOpen((v) => !v)} className={`flex h-11 w-11 items-center justify-center rounded-full ${keyboardOpen ? 'bg-[#2A2420] text-[#FAF5EB]' : 'bg-[#F2ECDF] text-[#5A4F44]'}`} aria-label="Keyboard"><Keyboard className="h-[18px] w-[18px]" /></button>
                {keyboardOpen ? (
                  <div className="flex flex-1 items-center gap-2 px-1">
                    <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)} placeholder="Ask TALA anything…" className="flex-1 bg-transparent text-[14px] text-[#2A2420] placeholder:text-[#8A7E6E] focus:outline-none" />
                    <button onClick={() => sendMessage(input)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2A2420] text-[#FAF5EB]"><Send className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button onClick={handleMicTap} className="relative flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#2A2420] text-[#FAF5EB] shadow-soft">
                    <span className="absolute inset-0 rounded-full ring-2 ring-[#BA6A43]/30 ring-offset-2 ring-offset-white" />
                    {voiceState === 'idle' ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    <span className="text-[13px] font-medium">{isConnecting ? 'Connecting…' : voiceState === 'idle' ? 'Tap to speak' : 'On call · tap to end'}</span>
                  </button>
                )}
                <button onClick={() => { const url = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70'; appendMessage({ role: 'user', kind: 'image', image: url }); runQuery('Check out this photo', null, { text: 'Beautiful — looks like the north end of Long Beach around golden hour. Want me to pin it?' }); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2ECDF] text-[#5A4F44]" aria-label="Upload image"><ImageIcon className="h-[18px] w-[18px]" /></button>
                <button onClick={() => { const pin: LocationPin = { id: 'pin-me', name: 'Your current location', distance: 'Alimanguan, San Vicente', meta: 'Shared just now with TALA', category: 'town' }; appendMessage({ role: 'user', kind: 'location', location: pin }); runQuery('What is near me?', 'food', { text: "Three places within 1 km. Kuya Boy's is the top pick tonight — fresh tuna just off the boat.", cards: [MOCK_BUSINESSES.food[0]] }); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2ECDF] text-[#5A4F44]" aria-label="Share location"><MapPin className="h-[18px] w-[18px]" /></button>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <button onClick={() => setToast('Connecting you with a host…')} className="flex items-center gap-2 rounded-full border hairline bg-white px-3 py-2 text-[12px] text-[#2A2420] shadow-soft"><Headphones className="h-3.5 w-3.5 text-[#435947]" /> Talk to a human host</button>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8A7E6E]"><span className="h-1 w-1 rounded-full bg-[#435947]" /> End-to-end encrypted</div>
              </div>
            </section>
          </>
        )}

        {!showTala && <TabPanel tab={activeNav} onClose={() => setActiveNav('tala')} reservations={reservations} favorites={favoriteSet} favoriteBusinesses={favoriteBusinesses} />}

        {/* Bottom Nav */}
        <nav className="sticky bottom-0 mt-auto border-t hairline bg-[#FAF5EB]/95 px-4 pb-5 pt-3 backdrop-blur">
          <div className="flex items-center justify-between">
            {[
              { key: 'map', label: 'Map', Icon: Map },
              { key: 'community', label: 'Community', Icon: Users },
              { key: 'tala', label: 'TALA', Icon: Sparkles, center: true },
              { key: 'experiences', label: 'Experiences', Icon: Compass },
              { key: 'profile', label: 'Profile', Icon: User },
            ].map(({ key, label, Icon, center }) => {
              const active = activeNav === key;
              if (center) {
                return (
                  <button key={key} onClick={() => onNav(key as NavKey)} className="relative -mt-8 flex flex-col items-center">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full shadow-card ring-4 ring-[#FAF5EB] ${active ? 'bg-[#2A2420] text-[#FAF5EB]' : 'bg-[#D7CAAB] text-[#2A2420]'}`}><Sparkles className="h-5 w-5" /></span>
                    <span className={`mt-1 text-[10.5px] ${active ? 'font-semibold text-[#2A2420]' : 'text-[#8A7E6E]'}`}>{label}</span>
                  </button>
                );
              }
              return (
                <button key={key} onClick={() => onNav(key as NavKey)} className="flex flex-1 flex-col items-center gap-1 py-1">
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#BA6A43]' : 'text-[#8A7E6E]'}`} />
                  <span className={`text-[10.5px] ${active ? 'font-semibold text-[#2A2420]' : 'text-[#8A7E6E]'}`}>{label}</span>
                </button>
              );
            })}
          </div>
          <div className="mx-auto mt-3 h-1 w-28 rounded-full bg-[#2A2420]/70" />
        </nav>
      </div>

      {toast && <div className="fade-up fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#2A2420] px-4 py-2.5 text-[12.5px] text-[#FAF5EB] shadow-luxe">{toast}</div>}
      <ReservationModal open={!!reserveTarget} onClose={() => setReserveTarget(null)} business={reserveTarget} onConfirm={confirmReservation} />
      <div className="mx-auto mt-6 max-w-[430px] text-center text-[11px] uppercase tracking-[0.24em] text-[#8A7E6E]">TALA · Built for San Vicente · Made for people</div>
    </div>
  );
}
