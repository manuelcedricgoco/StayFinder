import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

export function PropertyMap({ latitude, longitude, name }: PropertyMapProps) {
  const position: [number, number] = [latitude, longitude];

  return (
    <div className="mt-3 h-72 overflow-hidden rounded-xl border border-slate-200 sm:h-96">
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        className="h-full w-full"
        aria-label={`Map showing the location of ${name}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={position}
          radius={9}
          pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 0.9 }}
        >
          <Popup>{name}</Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
