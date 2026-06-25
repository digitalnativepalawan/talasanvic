import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, MapPin, Waves, Mountain, Sailboat } from 'lucide-react';

type PinCategory = 'barangay' | 'beach' | 'falls' | 'island';

type MapPinData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PinCategory;
  blurb: string;
};

const BARANGAYS: MapPinData[] = [
  { id: 'brgy-binga', name: 'Binga', lat: 10.6395, lng: 119.2230, category: 'barangay', blurb: 'Northernmost barangay - quiet coastline, home to Binga Beach Resort.' },
  { id: 'brgy-caruray', name: 'Caruray', lat: 10.5980, lng: 119.1840, category: 'barangay', blurb: 'Remote southern-Taytay-border barangay with Sta. Cruz cove.' },
  { id: 'brgy-port-barton', name: 'Port Barton', lat: 10.4108, lng: 119.1785, category: 'barangay', blurb: 'Backpacker hub and gateway to Port Barton Marine Park island-hopping.' },
  { id: 'brgy-kemdeng', name: 'Kemdeng', lat: 10.4550, lng: 119.2120, category: 'barangay', blurb: 'Inland farming barangay between Port Barton and the Poblacion side.' },
  { id: 'brgy-new-canipo', name: 'New Canipo', lat: 10.4830, lng: 119.2300, category: 'barangay', blurb: 'Small interior barangay along the road connecting the two coasts.' },
  { id: 'brgy-sto-nino', name: 'Sto. Nino', lat: 10.5050, lng: 119.2600, category: 'barangay', blurb: 'Home to Bato ni Ningning - wind-sculpted dunes, far from Long Beach crowds.' },
  { id: 'brgy-alimanguan', name: 'Alimanguan', lat: 10.5550, lng: 119.2480, category: 'barangay', blurb: 'Long Beach quiet northern stretch - boutique resorts, fewer crowds.' },
  { id: 'brgy-new-agutaya', name: 'New Agutaya', lat: 10.5430, lng: 119.2510, category: 'barangay', blurb: 'Long Beach frontage - sourdough cafes and beach bars.' },
  { id: 'brgy-poblacion', name: 'Poblacion', lat: 10.5306, lng: 119.2548, category: 'barangay', blurb: 'Town center - municipal hall, market, port, airport 2.5 km away.' },
  { id: 'brgy-san-isidro', name: 'San Isidro', lat: 10.5190, lng: 119.2560, category: 'barangay', blurb: 'Southern end of Long Beach, transitioning toward Puerto Princesa.' },
];

const POIS: MapPinData[] = [
  { id: 'poi-long-beach', name: 'Long Beach', lat: 10.5380, lng: 119.2520, category: 'beach', blurb: '14.7 km of white sand - the longest contiguous beach in the Philippines.' },
  { id: 'poi-port-barton-marine-park', name: 'Port Barton Marine Park', lat: 10.4350, lng: 119.1600, category: 'island', blurb: 'Protected reef and island-hopping circuit off Port Barton.' },
  { id: 'poi-boayan', name: 'Boayan Island', lat: 10.4520, lng: 119.1180, category: 'island', blurb: 'White-sand island stop on most Port Barton island-hopping tours.' },
  { id: 'poi-bigaho-falls', name: 'Bigaho Falls', lat: 10.4180, lng: 119.2080, category: 'falls', blurb: 'Jungle waterfall hike near Port Barton - rope-assisted climb up.' },
  { id: 'poi-cape-sunset', name: 'Cape San Vicente Sunset Cliff', lat: 10.5260, lng: 119.2470, category: 'beach', blurb: '15-minute hike, free access, golden-hour gathering spot.' },
];

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

function divIcon(category: PinCategory) {
  const color = CATEGORY_COLOR[category];
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '(c) OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles (c) Esri',
  },
};

const FILTERS: { key: PinCategory; label: string }[] = [
  { key: 'barangay', label: 'Barangays' },
  { key: 'beach', label: 'Beaches' },
  { key: 'falls', label: 'Falls' },
  { key: 'island', label: 'Islands' },
];

function RecenterControl({ center }: { center: [number, number] }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.flyTo(center, 12, { duration: 0.8 })}
      className="absolute bottom-3 right-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-full border hairline bg-white text-[#5A4F44] shadow-soft"
      aria-label="Recenter map"
    >
      <MapPin className="h-4 w-4" />
    </button>
  );
}

export default function IslandMap() {
  const [baseLayer, setBaseLayer] = useState<'street' | 'satellite'>('satellite');
  const [activeFilters, setActiveFilters] = useState<Set<PinCategory>>(
    new Set(['barangay', 'beach', 'falls', 'island'])
  );

  const center: [number, number] = [10.51, 119.225];

  const toggleFilter = (key: PinCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visiblePins = useMemo(
    () => [...BARANGAYS, ...POIS].filter((p) => activeFilters.has(p.category)),
    [activeFilters]
  );

  const tile = TILE_LAYERS[baseLayer];

  return (
    <div className="space-y-3">
      <div className="relative h-80 w-full overflow-hidden rounded-[24px] border hairline shadow-card">
        <MapContainer
          center={center}
          zoom={11}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={tile.url} attribution={tile.attribution} />
          {visiblePins.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={divIcon(p.category)}>
              <Popup>
                <div className="text-[13px] font-medium text-[#2A2420]">{p.name}</div>
                <div className="mt-1 text-[11.5px] text-[#5A4F44]">{p.blurb}</div>
              </Popup>
            </Marker>
          ))}
          <RecenterControl center={center} />
        </MapContainer>

        <div className="absolute left-3 top-3 z-[1000] flex overflow-hidden rounded-full border hairline bg-white/95 shadow-soft">
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

        <div className="absolute right-3 top-3 z-[1000] rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#2A2420] shadow-soft">
          <MapPin className="mr-1 inline h-3 w-3 text-[#BA6A43]" /> {visiblePins.length} pins
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {FILTERS.map(({ key, label }) => {
          const Icon = CATEGORY_ICON[key];
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`flex items-center gap-2 rounded-[20px] border hairline p-3 text-[13px] shadow-soft transition-colors ${
                active ? 'bg-white text-[#2A2420]' : 'bg-[#F2ECDF] text-[#8A7E6E]'
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
