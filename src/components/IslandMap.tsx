import { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  MapPin,
  Waves,
  Mountain,
  Sailboat,
  Search,
  X,
  Navigation,
  Share2,
  Plus,
  Minus,
  LocateFixed,
} from 'lucide-react';

/* ============================================================
   IslandMap — San Vicente, Palawan interactive map
   Leaflet + react-leaflet · satellite/street toggle
   Barangays (10) + tourism POIs (beaches, falls, islands)
   Search, tap-to-detail card, near-me, manual zoom controls
   ============================================================ */

type PinCategory = 'barangay' | 'beach' | 'falls' | 'island';

type MapPinData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PinCategory;
  blurb: string;
  image: string;
  tag: string;
};

/* Barangays ordered north -> south along the coast.
   Port Barton and Poblacion coordinates verified (PhilAtlas).
   Remaining barangays placed relative to those two confirmed anchors
   and San Vicente's official north-to-south barrio order. */
const BARANGAYS: MapPinData[] = [
  { id: 'brgy-binga', name: 'Binga', lat: 10.6395, lng: 119.2230, category: 'barangay', tag: 'Barangay · Northernmost', blurb: 'Northernmost barangay — quiet coastline, home to Binga Beach Resort.', image: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-caruray', name: 'Caruray', lat: 10.5980, lng: 119.1840, category: 'barangay', tag: 'Barangay · Remote', blurb: 'Remote barangay near the Taytay border with Sta. Cruz cove.', image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-port-barton', name: 'Port Barton', lat: 10.4108, lng: 119.1785, category: 'barangay', tag: 'Barangay · Backpacker hub', blurb: 'Backpacker hub and gateway to Port Barton Marine Park island-hopping.', image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-kemdeng', name: 'Kemdeng', lat: 10.4550, lng: 119.2120, category: 'barangay', tag: 'Barangay · Inland', blurb: 'Inland farming barangay between Port Barton and the Poblacion side.', image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-new-canipo', name: 'New Canipo', lat: 10.4830, lng: 119.2300, category: 'barangay', tag: 'Barangay · Interior', blurb: 'Small interior barangay along the road connecting the two coasts.', image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-sto-nino', name: 'Sto. Niño', lat: 10.5050, lng: 119.2600, category: 'barangay', tag: 'Barangay · Dunes', blurb: 'Home to Bato ni Ningning — wind-sculpted dunes, far from Long Beach crowds.', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-alimanguan', name: 'Alimanguan', lat: 10.5550, lng: 119.2480, category: 'barangay', tag: 'Barangay · Long Beach north', blurb: "Long Beach's quiet northern stretch — boutique resorts, fewer crowds.", image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-new-agutaya', name: 'New Agutaya', lat: 10.5430, lng: 119.2510, category: 'barangay', tag: 'Barangay · Long Beach', blurb: 'Long Beach frontage — sourdough cafés and beach bars.', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-poblacion', name: 'Poblacion', lat: 10.5306, lng: 119.2548, category: 'barangay', tag: 'Barangay · Town center', blurb: 'Town center — municipal hall, market, port, airport 2.5 km away.', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=70' },
  { id: 'brgy-san-isidro', name: 'San Isidro', lat: 10.5190, lng: 119.2560, category: 'barangay', tag: 'Barangay · Long Beach south', blurb: 'Southern end of Long Beach, transitioning toward Puerto Princesa.', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=70' },
];

const POIS: MapPinData[] = [
  { id: 'poi-long-beach', name: 'Long Beach', lat: 10.5380, lng: 119.2520, category: 'beach', tag: 'Beach · 14.7 km', blurb: '14.7 km of white sand — the longest contiguous beach in the Philippines.', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=70' },
  { id: 'poi-port-barton-marine-park', name: 'Port Barton Marine Park', lat: 10.4350, lng: 119.1600, category: 'island', tag: 'Marine Park · Reef', blurb: 'Protected reef and island-hopping circuit off Port Barton.', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70' },
  { id: 'poi-boayan', name: 'Boayan Island', lat: 10.4520, lng: 119.1180, category: 'island', tag: 'Island · Island-hop stop', blurb: 'White-sand island stop on most Port Barton island-hopping tours.', image: 'https://images.unsplash.com/photo-1573790387438-4da905039392?auto=format&fit=crop&w=900&q=70' },
  { id: 'poi-bigaho-falls', name: 'Bigaho Falls', lat: 10.4180, lng: 119.2080, category: 'falls', tag: 'Waterfall · Jungle hike', blurb: 'Jungle waterfall hike near Port Barton — rope-assisted climb up.', image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=70' },
  { id: 'poi-cape-sunset', name: 'Cape San Vicente Sunset Cliff', lat: 10.5260, lng: 119.2470, category: 'beach', tag: 'Viewpoint · Free', blurb: '15-minute hike, free access, golden-hour gathering spot.', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70' },
];

const ALL_PINS = [...BARANGAYS, ...POIS];

const CATEGORY_COLOR: Record<PinCategory, string> = {
  barangay: '#1C3A4A',
  beach: '#BA6A43',
  falls: '#435947',
  island: '#8A6A43',
};

const CATEGORY_ICON: Record<PinCategory, typeof MapPin> = {
  barangay: MapPin,
  beach: Waves,
  falls: Mountain,
  island: Sailboat,
};

function divIcon(category: PinCategory, selected: boolean) {
  const color = CATEGORY_COLOR[category];
  const size = selected ? 32 : 26;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${selected ? 3 : 2}px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

const FILTERS: { key: PinCategory; label: string }[] = [
  { key: 'barangay', label: 'Barangays' },
  { key: 'beach', label: 'Beaches' },
  { key: 'falls', label: 'Falls' },
  { key: 'island', label: 'Islands' },
];

const DEFAULT_CENTER: [number, number] = [10.51, 119.225];

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-3 left-3 z-[1000] flex flex-col overflow-hidden rounded-full border hairline bg-white/95 shadow-soft">
      <button onClick={() => map.zoomIn()} className="flex h-9 w-9 items-center justify-center text-[#2A2420]" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
      <div className="h-px w-full bg-[#D7CAAB]/40" />
      <button onClick={() => map.zoomOut()} className="flex h-9 w-9 items-center justify-center text-[#2A2420]" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
    </div>
  );
}

function FlyToControl({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const lastTarget = useRef<[number, number] | null>(null);
  if (target && (!lastTarget.current || target[0] !== lastTarget.current[0] || target[1] !== lastTarget.current[1])) {
    lastTarget.current = target;
    map.flyTo(target, 14, { duration: 0.9 });
  }
  return null;
}

function LocateControl({ onLocate }: { onLocate: (pos: [number, number]) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onLocate(coords);
        map.flyTo(coords, 14, { duration: 0.9 });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };
  return (
    <button
      onClick={handleLocate}
      className="absolute bottom-3 right-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white text-[#5A4F44] shadow-soft"
      aria-label="Find my location"
    >
      <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />
    </button>
  );
}

function PinDetailCard({ pin, onClose }: { pin: MapPinData; onClose: () => void }) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`;
  const shareText = `${pin.name} — San Vicente, Palawan`;
  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: pin.name, text: shareText, url: directionsUrl }); } catch { /* user cancelled */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} — ${directionsUrl}`);
    }
  };
  return (
    <div className="fade-up absolute inset-x-0 bottom-0 z-[1100] overflow-hidden rounded-t-[28px] bg-[#FFFDF8] shadow-luxe">
      <div className="relative h-40 w-full overflow-hidden">
        <img src={pin.image} alt={pin.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2A2420]/70 via-transparent to-transparent" />
        <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#2A2420] shadow-soft backdrop-blur-sm">
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="font-serif-display text-[20px] leading-tight text-[#FFFDF8] drop-shadow-sm">{pin.name}</div>
          <div className="mt-0.5 text-[11.5px] text-[#FFFDF8]/80">{pin.tag}</div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[13px] leading-relaxed text-[#5A4F44]">{pin.blurb}</p>
        <div className="flex items-center gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#2A2420] py-3 text-[12.5px] font-medium text-[#FAF5EB]"
          >
            <Navigation className="h-3.5 w-3.5" /> Get Directions
          </a>
          <button onClick={handleShare} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2ECDF] text-[#5A4F44]">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IslandMap() {
  const [baseLayer, setBaseLayer] = useState<'street' | 'satellite'>('satellite');
  const [activeFilters, setActiveFilters] = useState<Set<PinCategory>>(
    new Set(['barangay', 'beach', 'falls', 'island'])
  );
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<MapPinData | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const toggleFilter = (key: PinCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visiblePins = useMemo(
    () => ALL_PINS.filter((p) => activeFilters.has(p.category)),
    [activeFilters]
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_PINS.filter((p) => p.name.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const selectPin = (pin: MapPinData) => {
    setSelectedPin(pin);
    setFlyTarget([pin.lat, pin.lng]);
    setSearchOpen(false);
    setQuery('');
  };

  const tile = TILE_LAYERS[baseLayer];

  return (
    <div className="space-y-3">
      <div className="relative h-[420px] w-full overflow-hidden rounded-[24px] border hairline shadow-card">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={11}
          scrollWheelZoom
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={tile.url} attribution={tile.attribution} />
          {visiblePins.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={divIcon(p.category, selectedPin?.id === p.id)}
              eventHandlers={{ click: () => selectPin(p) }}
            />
          ))}
          {userPos && (
            <Marker
              position={userPos}
              icon={L.divIcon({
                className: '',
                html: `<div style="width:16px;height:16px;border-radius:50%;background:#1C3A4A;border:3px solid white;box-shadow:0 0 0 4px rgba(28,58,74,0.25);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}
          <ZoomControls />
          <LocateControl onLocate={setUserPos} />
          <FlyToControl target={flyTarget} />
        </MapContainer>

        {/* search bar */}
        <div className="absolute left-3 right-3 top-3 z-[1000]">
          <div className="flex items-center gap-2 rounded-full border hairline bg-white/95 px-3.5 py-2 shadow-soft">
            <Search className="h-4 w-4 shrink-0 text-[#8A7E6E]" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search beaches, barangays, falls…"
              className="flex-1 bg-transparent text-[13px] text-[#2A2420] placeholder:text-[#8A7E6E] focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setSearchOpen(false); }} className="text-[#8A7E6E]"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="mt-1.5 overflow-hidden rounded-[18px] border hairline bg-white shadow-card">
              {searchResults.map((p) => {
                const Icon = CATEGORY_ICON[p.category];
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPin(p)}
                    className="flex w-full items-center gap-2.5 border-b border-[#D7CAAB]/30 px-3.5 py-2.5 text-left last:border-none"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: CATEGORY_COLOR[p.category] }} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-[#2A2420]">{p.name}</div>
                      <div className="truncate text-[10.5px] text-[#8A7E6E]">{p.tag}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* base layer toggle */}
        <div className="absolute left-3 top-[58px] z-[1000] flex overflow-hidden rounded-full border hairline bg-white/95 shadow-soft">
          <button
            onClick={() => setBaseLayer('street')}
            className={`px-3 py-1.5 text-[11px] font-medium ${baseLayer === 'street' ? 'bg-[#435947] text-white' : 'text-[#2A2420]'}`}
          >
            Street
          </button>
          <button
            onClick={() => setBaseLayer('satellite')}
            className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium ${baseLayer === 'satellite' ? 'bg-[#435947] text-white' : 'text-[#2A2420]'}`}
          >
            <Layers className="h-3 w-3" /> Satellite
          </button>
        </div>

        <div className="absolute right-3 top-[58px] z-[1000] rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#2A2420] shadow-soft">
          <MapPin className="mr-1 inline h-3 w-3 text-[#BA6A43]" /> {visiblePins.length} pins
        </div>

        {selectedPin && <PinDetailCard pin={selectedPin} onClose={() => setSelectedPin(null)} />}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {FILTERS.map(({ key, label }) => {
          const Icon = CATEGORY_ICON[key];
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`flex items-center gap-2 rounded-[20px] border p-3 text-[13px] shadow-soft transition-colors ${
                active ? 'border-[#435947]/30 bg-white text-[#2A2420]' : 'border-transparent bg-[#F2ECDF] text-[#8A7E6E]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: active ? CATEGORY_COLOR[key] : '#8A7E6E' }} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
