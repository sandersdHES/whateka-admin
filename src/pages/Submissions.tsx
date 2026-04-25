import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  LayoutGrid,
  Layers,
  MapPin,
  Pencil,
  Save,
  Search,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import type { ActivitySubmission } from '../lib/types';
import { categoryLabel, formatDate, formatDuration, formatPrice } from '../lib/format';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { ActivityForm, formToPayload } from '../components/ActivityForm';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

type Tab = 'pending' | 'on_hold' | 'tracked' | 'all';
type SortKey = 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc';
type ViewMode = 'table' | 'cards';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created_desc', label: 'Plus récentes' },
  { value: 'created_asc', label: 'Plus anciennes' },
  { value: 'title_asc', label: 'Titre A → Z' },
  { value: 'title_desc', label: 'Titre Z → A' },
];

export function Submissions() {
  const [rows, setRows] = useState<ActivitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('created_desc');
  const [editing, setEditing] = useState<ActivitySubmission | null>(null);
  const [rejecting, setRejecting] = useState<ActivitySubmission | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cardIndex, setCardIndex] = useState(0);
  const { adminProfile } = useAuth();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as ActivitySubmission[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const base = rows.filter((r) => {
      if (tab === 'pending' && r.status !== 'pending') return false;
      if (tab === 'on_hold' && r.status !== 'on_hold') return false;
      if (tab === 'tracked') {
        if (!(r as any).update_frequency) return false;
      }
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const titleCmp = (a: ActivitySubmission, b: ActivitySubmission) =>
      a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
    const dateCmp = (a: ActivitySubmission, b: ActivitySubmission) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    const sorted = [...base];
    switch (sort) {
      case 'title_asc':
        sorted.sort(titleCmp);
        break;
      case 'title_desc':
        sorted.sort((a, b) => -titleCmp(a, b));
        break;
      case 'created_asc':
        sorted.sort(dateCmp);
        break;
      case 'created_desc':
      default:
        sorted.sort((a, b) => -dateCmp(a, b));
    }
    return sorted;
  }, [rows, tab, search, sort]);

  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const onHoldCount = rows.filter((r) => r.status === 'on_hold').length;
  const trackedCount = rows.filter((r) => !!(r as any).update_frequency).length;

  async function handleHold(s: ActivitySubmission) {
    const { error } = await supabase
      .from('activity_submissions')
      .update({
        status: 'on_hold',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile?.email ?? null,
      })
      .eq('id', s.id);
    if (error) toast.error(error.message);
    else toast.success('Soumission mise en attente.');
    await load();
  }

  async function handleReopen(s: ActivitySubmission) {
    const { error } = await supabase
      .from('activity_submissions')
      .update({
        status: 'pending',
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq('id', s.id);
    if (error) toast.error(error.message);
    else toast.success('Soumission remise dans les nouvelles.');
    await load();
  }

  async function handleSave(values: Parameters<typeof formToPayload>[0]) {
    if (!editing) return;
    const payload = formToPayload(values);
    const { error } = await supabase
      .from('activity_submissions')
      .update(payload)
      .eq('id', editing.id);
    if (error) throw new Error(error.message);
    toast.success('Soumission mise à jour.');
    setEditing(null);
    await load();
  }

  async function handleApprove(s: ActivitySubmission) {
    const payload = formToPayload({
      title: s.title,
      location_name: s.location_name,
      categories: (s.category ?? '').split(',').map((c) => c.trim()).filter(Boolean) as never,
      description: s.description ?? '',
      activity_url: s.activity_url ?? '',
      image_url: s.image_url ?? '',
      latitude: s.latitude,
      longitude: s.longitude,
      duration_hours: (s.duration_minutes ?? 0) / 60,
      price_level: s.price_level ?? 1,
      features: s.features ?? [],
      seasons: s.seasons ?? [],
      social_tags: s.social_tags ?? [],
      is_indoor: s.is_indoor ?? false,
      is_outdoor: s.is_outdoor ?? true,
      date_label: (s as any).date_label ?? '',
      date_start: (s as any).date_start ?? '',
      date_end: (s as any).date_end ?? '',
      recurrence_type: (s as any).recurrence_type ?? '',
      seasonal_months: (s as any).seasonal_months ?? [],
      weekly_days: (s as any).weekly_days ?? [],
      update_frequency: (s as any).update_frequency ?? '',
      next_update_at: (s as any).next_update_at ?? '',
      update_notes: (s as any).update_notes ?? '',
    });
    const { error: insErr } = await supabase.from('activities').insert(payload);
    if (insErr) {
      toast.error(`Création activité: ${insErr.message}`);
      return;
    }
    const { error: updErr } = await supabase
      .from('activity_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile?.email ?? null,
      })
      .eq('id', s.id);
    if (updErr) toast.error(updErr.message);
    else toast.success('Soumission approuvée.');
    await load();
  }

  async function handleReject() {
    if (!rejecting) return;
    const { error } = await supabase
      .from('activity_submissions')
      .update({
        status: 'rejected',
        admin_notes: rejectNote || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile?.email ?? null,
      })
      .eq('id', rejecting.id);
    if (error) toast.error(error.message);
    else toast.success('Soumission rejetée.');
    setRejecting(null);
    setRejectNote('');
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Soumissions</h1>
        <p className="text-sm text-slate-500">
          {pendingCount} nouvelle{pendingCount > 1 ? 's' : ''} · {onHoldCount} en attente.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="inline-flex overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          {(['pending', 'on_hold', 'tracked', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t ? 'bg-brand-cyan text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t === 'pending'
                ? `Nouvelles (${pendingCount})`
                : t === 'on_hold'
                  ? `En attente (${onHoldCount})`
                  : t === 'tracked'
                    ? `À tenir à jour (${trackedCount})`
                    : 'Toutes'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par titre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input max-w-[200px]"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Tri"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="inline-flex overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${
              viewMode === 'table' ? 'bg-brand-cyan text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
            title="Vue tableau"
          >
            <LayoutGrid size={14} /> Tableau
          </button>
          <button
            onClick={() => {
              setViewMode('cards');
              setCardIndex(0);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${
              viewMode === 'cards' ? 'bg-brand-cyan text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
            title="Vue cartes (style Tinder)"
          >
            <Layers size={14} /> Cartes
          </button>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucune soumission" description="Rien à traiter pour le moment." />
      ) : viewMode === 'cards' ? (
        <CardDeck
          submissions={filtered}
          index={cardIndex}
          onIndexChange={setCardIndex}
          onApprove={handleApprove}
          onHold={handleHold}
          onReopen={handleReopen}
          onReject={(s) => setRejecting(s)}
          onEdit={(s) => setEditing(s)}
          onLocationChange={async (s, lat, lng) => {
            const { error } = await supabase
              .from('activity_submissions')
              .update({ latitude: lat, longitude: lng })
              .eq('id', s.id);
            if (error) toast.error(error.message);
            else {
              toast.success('Localisation mise à jour.');
              await load();
            }
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Soumission</th>
                <th className="px-4 py-3">Lieu</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Soumis le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-500">
                      #{s.id} · {categoryLabel(s.category)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.location_name}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDuration(s.duration_minutes)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        s.status === 'pending'
                          ? 'bg-sky-100 text-sky-800'
                          : s.status === 'on_hold'
                            ? 'bg-amber-100 text-amber-800'
                            : s.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {s.status === 'pending'
                        ? 'Nouvelle'
                        : s.status === 'on_hold'
                          ? 'En attente'
                          : s.status === 'approved'
                            ? 'Approuvée'
                            : 'Rejetée'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {s.activity_url && (
                        <a
                          href={s.activity_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Ouvrir"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <button
                        onClick={() => setEditing(s)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        title="Éditer"
                      >
                        <Pencil size={16} />
                      </button>
                      {(s.status === 'pending' || s.status === 'on_hold') && (
                        <>
                          <button
                            onClick={() => handleApprove(s)}
                            className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Approuver"
                          >
                            <Check size={16} />
                          </button>
                          {s.status === 'pending' ? (
                            <button
                              onClick={() => handleHold(s)}
                              className="rounded-md p-2 text-amber-600 hover:bg-amber-50"
                              title="Mettre en attente"
                            >
                              <Clock size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReopen(s)}
                              className="rounded-md p-2 text-sky-600 hover:bg-sky-50"
                              title="Remettre dans les nouvelles"
                            >
                              <Clock size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => setRejecting(s)}
                            className="rounded-md p-2 text-rose-500 hover:bg-rose-50"
                            title="Rejeter"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Éditer la soumission"
        maxWidth="max-w-4xl"
      >
        {editing && (
          <ActivityForm
            initial={editing}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            submitLabel="Mettre à jour"
          />
        )}
      </Modal>

      <Modal
        open={rejecting !== null}
        onClose={() => {
          setRejecting(null);
          setRejectNote('');
        }}
        title="Rejeter la soumission"
      >
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Tu t'apprêtes à rejeter <strong>{rejecting.title}</strong>. Tu peux ajouter un
              commentaire facultatif (visible dans les notes admin).
            </p>
            <textarea
              className="input min-h-[100px]"
              placeholder="Motif du rejet (facultatif)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setRejecting(null);
                  setRejectNote('');
                }}
              >
                Annuler
              </button>
              <button className="btn-danger" onClick={handleReject}>
                Confirmer le rejet
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CardDeck : vue Tinder-style pour parcourir les soumissions une par une.
// 3 boutons en bas : Rejeter / Mettre en attente / Approuver
// + bouton éditer + flèches pour skip sans action.
// ─────────────────────────────────────────────────────────────────────────────

// Icone marker custom (leaflet par defaut casse avec Vite)
const _cardMarkerIcon = L.divIcon({
  html: '<div style="width:26px;height:26px;background:#FF6F61;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function _CardMapClick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CardDeck({
  submissions,
  index,
  onIndexChange,
  onApprove,
  onHold,
  onReopen,
  onReject,
  onEdit,
  onLocationChange,
}: {
  submissions: ActivitySubmission[];
  index: number;
  onIndexChange: (i: number) => void;
  onApprove: (s: ActivitySubmission) => void;
  onHold: (s: ActivitySubmission) => void;
  onReopen: (s: ActivitySubmission) => void;
  onReject: (s: ActivitySubmission) => void;
  onEdit: (s: ActivitySubmission) => void;
  onLocationChange: (s: ActivitySubmission, lat: number, lng: number) => void;
}) {
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Reset les coords pendantes a chaque changement de carte
  useEffect(() => {
    setPendingCoords(null);
  }, [index, submissions]);
  const safeIndex = Math.min(index, submissions.length - 1);
  const s = submissions[safeIndex];
  if (!s) return null;

  const cats = (s.category ?? '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
  const statusLabel =
    s.status === 'pending'
      ? 'Nouvelle'
      : s.status === 'on_hold'
        ? 'En attente'
        : s.status === 'approved'
          ? 'Approuvée'
          : 'Rejetée';
  const statusCls =
    s.status === 'pending'
      ? 'bg-sky-100 text-sky-800'
      : s.status === 'on_hold'
        ? 'bg-amber-100 text-amber-800'
        : s.status === 'approved'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-rose-100 text-rose-800';

  const next = (delta: number) => {
    const newIdx = Math.max(0, Math.min(submissions.length - 1, safeIndex + delta));
    onIndexChange(newIdx);
  };
  const advance = () => next(1);

  const isActive = s.status === 'pending' || s.status === 'on_hold';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Compteur + skip arrows */}
      <div className="flex w-full max-w-2xl items-center justify-between">
        <button
          onClick={() => next(-1)}
          disabled={safeIndex === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-30"
          title="Précédent"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-sm font-medium text-slate-600">
          {safeIndex + 1} <span className="text-slate-400">/ {submissions.length}</span>
        </div>
        <button
          onClick={() => next(1)}
          disabled={safeIndex >= submissions.length - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-30"
          title="Suivant (sans action)"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/60">
        {/* Image */}
        <div className="relative h-72 w-full bg-slate-100">
          {s.image_url ? (
            <img
              key={s.id}
              src={s.image_url}
              alt={s.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
              Aucune image
            </div>
          )}
          {/* Status badge */}
          <span
            className={`badge absolute right-4 top-4 ${statusCls} backdrop-blur-sm`}
          >
            {statusLabel}
          </span>
          {/* Categories */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <span
                key={c}
                className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 backdrop-blur-sm"
              >
                {categoryLabel(c)}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-slate-900">{s.title}</h3>
              <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <MapPin size={14} />
                <span>{s.location_name}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {s.activity_url && (
                <a
                  href={s.activity_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Ouvrir le site"
                >
                  <ExternalLink size={16} />
                </a>
              )}
              <button
                onClick={() => onEdit(s)}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Éditer"
              >
                <Pencil size={16} />
              </button>
            </div>
          </div>

          {s.description && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.description}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <Meta label="Durée" value={formatDuration(s.duration_minutes)} />
            <Meta label="Prix" value={formatPrice(s.price_level)} />
            <Meta label="Soumis le" value={formatDate(s.created_at)} />
            <Meta label="Indoor / Outdoor" value={`${s.is_indoor ? 'Indoor' : ''}${s.is_indoor && s.is_outdoor ? ' · ' : ''}${s.is_outdoor ? 'Outdoor' : ''}` || '—'} />
          </div>

          {(s.features ?? []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(s.features ?? []).map((f) => (
                <span
                  key={f}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Map editable : clic pour changer la localisation */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Localisation {pendingCoords && <span className="ml-1 text-amber-600">(modifiée)</span>}
              </span>
              <span className="text-[11px] text-slate-500">
                {(pendingCoords?.lat ?? s.latitude).toFixed(5)}, {(pendingCoords?.lng ?? s.longitude).toFixed(5)}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200" style={{ height: 220 }}>
              <MapContainer
                key={s.id}
                center={[pendingCoords?.lat ?? s.latitude, pendingCoords?.lng ?? s.longitude]}
                zoom={13}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker
                  position={[pendingCoords?.lat ?? s.latitude, pendingCoords?.lng ?? s.longitude]}
                  icon={_cardMarkerIcon}
                />
                <_CardMapClick onPick={(lat, lng) => setPendingCoords({ lat, lng })} />
              </MapContainer>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Clique sur la carte pour ajuster la position du marqueur.
            </p>
            {pendingCoords && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    onLocationChange(s, pendingCoords.lat, pendingCoords.lng);
                    setPendingCoords(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                >
                  <Save size={13} /> Enregistrer la nouvelle position
                </button>
                <button
                  onClick={() => setPendingCoords(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 boutons d'action */}
      {isActive ? (
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => {
              onReject(s);
              advance();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg ring-4 ring-rose-100 transition hover:scale-105 hover:bg-rose-600 active:scale-95"
            title="Rejeter"
          >
            <X size={28} />
          </button>
          {s.status === 'pending' ? (
            <button
              onClick={() => {
                onHold(s);
                advance();
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg ring-4 ring-amber-100 transition hover:scale-105 hover:bg-amber-600 active:scale-95"
              title="Mettre en attente"
            >
              <Clock size={22} />
            </button>
          ) : (
            <button
              onClick={() => {
                onReopen(s);
                advance();
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg ring-4 ring-sky-100 transition hover:scale-105 hover:bg-sky-600 active:scale-95"
              title="Remettre dans les nouvelles"
            >
              <Clock size={22} />
            </button>
          )}
          <button
            onClick={() => {
              onApprove(s);
              advance();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-100 transition hover:scale-105 hover:bg-emerald-600 active:scale-95"
            title="Approuver"
          >
            <Check size={28} />
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
          Cette soumission est déjà {s.status === 'approved' ? 'approuvée' : 'rejetée'} — utilise les flèches pour passer à la suivante.
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-slate-700">{value}</div>
    </div>
  );
}
