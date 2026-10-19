import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';
import { formatPeso } from '../lib/listings';

interface OwnerRoom {
  id: string;
  propertyId: string;
  name: string;
  monthlyPrice: number | null;
  capacity: number;
  isAvailable: boolean;
}

interface RoomResponse {
  status: 'ok';
  rooms: OwnerRoom[];
}

export function OwnerRoomsPage() {
  const { propertyId = '' } = useParams<{ propertyId: string }>();
  const path = `/owner/properties/${encodeURIComponent(propertyId)}/rooms`;
  const { state, reload } = useApiResource<RoomResponse>(path);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [isAvailable, setIsAvailable] = useState(true);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCapacity, setEditCapacity] = useState('1');
  const [editAvailable, setEditAvailable] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('POST', path, {
        name,
        monthlyPrice: price ? Number(price) : null,
        capacity: Number(capacity),
        isAvailable,
      });
      setName('');
      setPrice('');
      setCapacity('1');
      setIsAvailable(true);
      reload();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not add the room.');
    } finally {
      setSaving(false);
    }
  }

  function startEditing(room: OwnerRoom) {
    setEditingRoomId(room.id);
    setEditName(room.name);
    setEditPrice(room.monthlyPrice === null ? '' : String(room.monthlyPrice));
    setEditCapacity(String(room.capacity));
    setEditAvailable(room.isAvailable);
    setError('');
  }

  async function updateRoom(event: FormEvent<HTMLFormElement>, roomId: string) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest('PUT', `/owner/rooms/${encodeURIComponent(roomId)}`, {
        name: editName,
        monthlyPrice: editPrice ? Number(editPrice) : null,
        capacity: Number(editCapacity),
        isAvailable: editAvailable,
      });
      setEditingRoomId(null);
      reload();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not update the room.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoom(room: OwnerRoom) {
    if (!window.confirm(`Delete "${room.name}"?`)) return;
    try {
      await apiRequest('DELETE', `/owner/rooms/${encodeURIComponent(room.id)}`);
      reload();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not delete the room.');
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to={`/owner/properties/${encodeURIComponent(propertyId)}`}>Back to property</BackLink>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">Manage rooms</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Add individual rooms or units and update their availability.</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{error}</p>}

      <form onSubmit={addRoom} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Room/unit name
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Monthly price override (optional)
          <input type="number" min="100" max="1000000" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Capacity
          <input required type="number" min="1" max="50" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)} className="h-4 w-4 accent-emerald-700" />
          Available
        </label>
        <button disabled={saving} type="submit" className="rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:col-span-2">
          {saving ? 'Adding…' : 'Add room'}
        </button>
      </form>

      {state.status === 'loading' && <p role="status" className="py-8 text-center text-slate-500 dark:text-slate-400">Loading rooms…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}
      {state.status === 'success' && state.data.rooms.length === 0 && <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-slate-600 dark:bg-slate-800 dark:text-slate-300">No individual rooms have been added.</p>}
      {state.status === 'success' && state.data.rooms.length > 0 && (
        <ul className="mt-6 space-y-3">
          {state.data.rooms.map((room) => (
            <li key={room.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              {editingRoomId === room.id ? (
                <form onSubmit={(event) => updateRoom(event, room.id)} className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Room/unit name
                    <input required maxLength={80} value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Monthly price override (optional)
                    <input type="number" min="100" max="1000000" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Capacity
                    <input required type="number" min="1" max="50" value={editCapacity} onChange={(event) => setEditCapacity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={editAvailable} onChange={(event) => setEditAvailable(event.target.checked)} className="h-4 w-4 accent-emerald-700" />
                    Available
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button disabled={saving} type="submit" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">Save changes</button>
                    <button type="button" onClick={() => setEditingRoomId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{room.name}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Capacity {room.capacity} · {room.monthlyPrice === null ? 'Uses property price' : `${formatPeso(room.monthlyPrice)} / month`} · {room.isAvailable ? 'Available' : 'Unavailable'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEditing(room)} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950">Edit</button>
                    <button type="button" onClick={() => deleteRoom(room)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
