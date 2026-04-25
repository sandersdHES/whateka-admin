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
  Sparkles,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import type { ActivitySubmission } from '../lib/types';
import { categoryLabel, formatDate, formatDuration, formatPrice } from '../lib/format';
import { CATEGORY_COLORS } from '../lib/types';
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
  const [locating, setLocating] = useState<ActivitySubmission | null>(null);
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
          onFieldUpdate={async (s, field, value) => {
            const { error } = await supabase
              .from('activity_submissions')
              .update({ [field]: value })
              .eq('id', s.id);
            if (error) {
              toast.error(`Échec mise à jour ${field}: ${error.message}`);
              throw new Error(error.message);
            }
            toast.success(`${field} mis à jour.`);
            await load();
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
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span>#{s.id}</span>
                      <CategoryChips category={s.category} />
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
                        onClick={() => setLocating(s)}
                        className="rounded-md p-2 text-slate-500 hover:bg-brand-cyan/10 hover:text-brand-cyan"
                        title="Vérifier / corriger la localisation"
                      >
                        <MapPin size={16} />
                      </button>
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
            extraActions={
              editing.status === 'pending' || editing.status === 'on_hold'
                ? [
                    {
                      label: 'Approuver',
                      color: 'emerald',
                      icon: <Check size={16} />,
                      onClick: async () => {
                        await handleApprove(editing);
                        setEditing(null);
                      },
                    },
                    editing.status === 'pending'
                      ? {
                          label: 'Mettre en attente',
                          color: 'amber',
                          icon: <Clock size={16} />,
                          onClick: async () => {
                            await handleHold(editing);
                            setEditing(null);
                          },
                        }
                      : {
                          label: 'Remettre dans les nouvelles',
                          color: 'sky',
                          icon: <Clock size={16} />,
                          onClick: async () => {
                            await handleReopen(editing);
                            setEditing(null);
                          },
                        },
                    {
                      label: 'Rejeter',
                      color: 'rose',
                      icon: <X size={16} />,
                      onClick: () => {
                        setRejecting(editing);
                        setEditing(null);
                      },
                    },
                  ]
                : undefined
            }
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

      {/* Modal localisation : vérifier / re-géocoder / corriger via carte */}
      <Modal
        open={locating !== null}
        onClose={() => setLocating(null)}
        title="Localisation"
        maxWidth="max-w-3xl"
      >
        {locating && (
          <LocationEditor
            submission={locating}
            onClose={() => setLocating(null)}
            onSave={async (lat, lng) => {
              const { error } = await supabase
                .from('activity_submissions')
                .update({ latitude: lat, longitude: lng })
                .eq('id', locating.id);
              if (error) toast.error(error.message);
              else {
                toast.success('Localisation mise à jour.');
                setLocating(null);
                await load();
              }
            }}
          />
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
  onFieldUpdate,
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
  onFieldUpdate: (s: ActivitySubmission, field: string, value: any) => void;
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
        {/* Image (cliquable pour rechercher si vide) */}
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
            <ImageEnricher submission={s} onAccept={(url) => onFieldUpdate(s, 'image_url', url)} />
          )}
          {/* Status badge */}
          <span
            className={`badge absolute right-4 top-4 ${statusCls} backdrop-blur-sm`}
          >
            {statusLabel}
          </span>
          {/* Categories — chips colorés */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            {cats.map((c) => {
              const color = CATEGORY_COLORS[c] ?? '#94a3b8';
              return (
                <span
                  key={c}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {categoryLabel(c)}
                </span>
              );
            })}
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

          <div className="mt-3">
            {s.description ? (
              <p className="text-sm leading-relaxed text-slate-600">{s.description}</p>
            ) : (
              <EnrichField
                submission={s}
                field="description"
                label="Description"
                onAccept={(v) => onFieldUpdate(s, 'description', v)}
              />
            )}
          </div>

          {/* URL si vide → bouton enrich */}
          {!s.activity_url && (
            <div className="mt-3">
              <EnrichField
                submission={s}
                field="activity_url"
                label="URL de l'activité"
                onAccept={(v) => onFieldUpdate(s, 'activity_url', v)}
              />
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <MetaOrEnrich
              label="Durée"
              empty={!s.duration_minutes}
              value={formatDuration(s.duration_minutes)}
              submission={s}
              field="duration_minutes"
              onAccept={(v) => onFieldUpdate(s, 'duration_minutes', v)}
            />
            <MetaOrEnrich
              label="Prix"
              empty={!s.price_level}
              value={formatPrice(s.price_level)}
              submission={s}
              field="price_level"
              onAccept={(v) => onFieldUpdate(s, 'price_level', v)}
            />
            <Meta label="Soumis le" value={formatDate(s.created_at)} />
            <Meta label="Indoor / Outdoor" value={`${s.is_indoor ? 'Indoor' : ''}${s.is_indoor && s.is_outdoor ? ' · ' : ''}${s.is_outdoor ? 'Outdoor' : ''}` || '—'} />
          </div>

          <div className="mt-4">
            {(s.features ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {(s.features ?? []).map((f) => (
                  <span
                    key={f}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                  >
                    {f}
                  </span>
                ))}
              </div>
            ) : (
              <EnrichField
                submission={s}
                field="features"
                label="Caractéristiques"
                onAccept={(v) => onFieldUpdate(s, 'features', v)}
              />
            )}
          </div>

          {/* Map editable : clic pour changer la localisation */}
          <div className="mt-5">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Localisation {pendingCoords && <span className="ml-1 text-amber-600">(modifiée)</span>}
              </span>
              <div className="flex items-center gap-3">
                <CardGeocodeButton
                  submission={s}
                  onResult={(lat, lng) => setPendingCoords({ lat, lng })}
                />
                <span className="text-[11px] text-slate-500">
                  {(pendingCoords?.lat ?? s.latitude).toFixed(5)}, {(pendingCoords?.lng ?? s.longitude).toFixed(5)}
                </span>
              </div>
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

/**
 * Affiche les catégories d'une activité sous forme de petites pastilles
 * colorées avec le label complet — pour utilisation inline dans tableaux
 * et listes denses (sans devoir ouvrir la fiche).
 */
export function CategoryChips({
  category,
  size = 'sm',
}: {
  category: string | null | undefined;
  size?: 'xs' | 'sm';
}) {
  if (!category) return null;
  const cats = category
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (cats.length === 0) return null;

  const padding = size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const text = size === 'xs' ? 'text-[10px]' : 'text-[11px]';

  return (
    <div className="flex flex-wrap gap-1">
      {cats.map((c) => {
        const color = CATEGORY_COLORS[c] ?? '#94a3b8';
        return (
          <span
            key={c}
            className={`inline-flex items-center rounded-full font-semibold text-white ${padding} ${text}`}
            style={{ backgroundColor: color }}
          >
            {categoryLabel(c)}
          </span>
        );
      })}
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

/**
 * Bouton compact "Localiser avec IA" pour la vue cartes.
 * Appelle geocode-place avec titre + lieu + Suisse, met les coords
 * pendantes à la valeur retournée. L'utilisateur valide ensuite via
 * le bouton "Enregistrer la nouvelle position" dans la map.
 */
function CardGeocodeButton({
  submission,
  onResult,
}: {
  submission: ActivitySubmission;
  onResult: (lat: number, lng: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'ok' | 'empty' | null>(null);

  async function run() {
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.functions.invoke<{
        lat?: number;
        lng?: number;
        display_name?: string;
        error?: string;
      }>('geocode-place', {
        body: { query: `${submission.title} ${submission.location_name} Switzerland` },
      });
      if (error || !data?.lat || !data?.lng) {
        setFeedback('empty');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        onResult(data.lat, data.lng);
        setFeedback('ok');
        setTimeout(() => setFeedback(null), 2500);
      }
    } catch (_e) {
      setFeedback('empty');
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setBusy(false);
    }
  }

  if (feedback === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <Check size={11} /> Localisation trouvée
      </span>
    );
  }
  if (feedback === 'empty') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
        Pas de résultat
      </span>
    );
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
      title="Localiser automatiquement via Google Places"
    >
      {busy ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />
          Localisation…
        </>
      ) : (
        <>
          <Sparkles size={11} />
          Localiser avec l'IA
        </>
      )}
    </button>
  );
}

/**
 * Modal pour vérifier/corriger la localisation d'une soumission.
 * - Map cliquable pour ajuster manuellement
 * - Bouton "Re-géocoder automatiquement" qui appelle geocode-place
 *   avec titre + lieu pour proposer de nouvelles coordonnées
 */
function LocationEditor({
  submission,
  onSave,
  onClose,
}: {
  submission: ActivitySubmission;
  onSave: (lat: number, lng: number) => void | Promise<void>;
  onClose: () => void;
}) {
  const [coords, setCoords] = useState({ lat: submission.latitude, lng: submission.longitude });
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);
  const original = { lat: submission.latitude, lng: submission.longitude };
  const changed = coords.lat !== original.lat || coords.lng !== original.lng;

  async function autoGeocode() {
    setGeocoding(true);
    setGeocodeMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke<{
        lat?: number;
        lng?: number;
        display_name?: string;
        error?: string;
      }>('geocode-place', {
        body: { query: `${submission.title} ${submission.location_name} Switzerland` },
      });
      if (error || !data?.lat || !data?.lng) {
        setGeocodeMsg('Aucun résultat trouvé via Google Places.');
      } else {
        setCoords({ lat: data.lat, lng: data.lng });
        setGeocodeMsg(`Trouvé : ${data.display_name ?? ''}`);
      }
    } catch (_e) {
      setGeocodeMsg('Erreur durant le géocodage.');
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="font-semibold text-slate-900">{submission.title}</div>
        <div className="text-xs text-slate-600">{submission.location_name}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">Coordonnées :</span>
          <span className={changed ? 'text-amber-600' : 'text-slate-600'}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </span>
          {changed && <span className="text-amber-600">(modifiées)</span>}
        </div>
        <button
          onClick={autoGeocode}
          disabled={geocoding}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-cyan bg-brand-cyan/10 px-3 py-1.5 text-xs font-semibold text-brand-cyan hover:bg-brand-cyan/20 disabled:opacity-50"
        >
          {geocoding ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
              Recherche…
            </>
          ) : (
            <>
              <Sparkles size={13} />
              Re-géocoder automatiquement
            </>
          )}
        </button>
      </div>

      {geocodeMsg && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
          {geocodeMsg}
        </div>
      )}

      <div className="overflow-hidden rounded-xl ring-1 ring-slate-200" style={{ height: 380 }}>
        <MapContainer
          key={`${submission.id}-${coords.lat}-${coords.lng}`}
          center={[coords.lat, coords.lng]}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[coords.lat, coords.lng]} icon={_cardMarkerIcon} />
          <_CardMapClick onPick={(lat, lng) => setCoords({ lat, lng })} />
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">
        Clique sur la carte pour ajuster manuellement ou utilise le bouton ci-dessus pour
        re-géocoder via Google Places.
      </p>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button onClick={onClose} className="btn-ghost">
          Fermer
        </button>
        <button
          onClick={() => onSave(coords.lat, coords.lng)}
          disabled={!changed}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Save size={14} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}

/**
 * Quand une soumission n'a pas d'image, affiche un placeholder cliquable
 * qui lance fetch-place-photo (Google Places). Si trouve, propose un
 * aperçu + accept/reject. Sinon, message "Pas d'information trouvée".
 */
function ImageEnricher({
  submission,
  onAccept,
}: {
  submission: ActivitySubmission;
  onAccept: (url: string) => void | Promise<void>;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'result' | 'empty' | 'saving'>('idle');
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  async function search() {
    setState('loading');
    try {
      const query = `${submission.title} ${submission.location_name} Switzerland`;
      const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
        'fetch-place-photo',
        { body: { query } },
      );
      if (error || !data?.url) {
        setState('empty');
        setTimeout(() => setState('idle'), 3000);
        return;
      }
      setImgUrl(data.url);
      setState('result');
    } catch (_e) {
      setState('empty');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={search}
        className="group flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
      >
        <Sparkles size={32} className="text-amber-400 transition group-hover:scale-110" />
        <div className="text-sm font-medium">Aucune image</div>
        <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 group-hover:bg-brand-cyan group-hover:text-white">
          ✨ Chercher avec l'IA
        </div>
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-500">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-brand-cyan" />
        <div className="text-sm">Recherche en cours…</div>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-rose-700">
        <X size={32} />
        <div className="text-sm font-medium">Pas d'information trouvée</div>
      </div>
    );
  }

  if (state === 'saving') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-emerald-700">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-emerald-200 border-t-emerald-600" />
        <div className="text-sm font-medium">Sauvegarde…</div>
      </div>
    );
  }

  // result : preview avec accept/reject
  async function handleAccept() {
    if (!imgUrl) return;
    setState('saving');
    try {
      await onAccept(imgUrl);
      setState('idle');
      setImgUrl(null);
    } catch (_e) {
      setState('result');
    }
  }

  return (
    <div className="relative h-full w-full">
      {imgUrl && (
        <img src={imgUrl} alt="Suggestion" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4">
        <button
          onClick={handleAccept}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          <Check size={13} /> Accepter
        </button>
        <button
          onClick={() => {
            setState('idle');
            setImgUrl(null);
          }}
          className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
        >
          Rejeter
        </button>
      </div>
    </div>
  );
}

function MetaOrEnrich({
  label,
  empty,
  value,
  submission,
  field,
  onAccept,
}: {
  label: string;
  empty: boolean;
  value: string;
  submission: ActivitySubmission;
  field: string;
  onAccept: (v: any) => void;
}) {
  if (!empty) return <Meta label={label} value={value} />;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <EnrichField
        submission={submission}
        field={field}
        label={label}
        compact
        onAccept={onAccept}
      />
    </div>
  );
}

/**
 * Champ "vide" cliquable qui lance l'edge function `enrich-submission`
 * (Gemini + Google Search) pour proposer une valeur. Si valeur trouvée,
 * affiche aperçu + accept/reject. Si aucune info, affiche un message.
 */
function EnrichField({
  submission,
  field,
  label,
  compact = false,
  onAccept,
}: {
  submission: ActivitySubmission;
  field: string;
  label: string;
  compact?: boolean;
  onAccept: (value: any) => void | Promise<void>;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'result' | 'empty' | 'saving'>('idle');
  const [suggestion, setSuggestion] = useState<any>(null);

  async function search() {
    setState('loading');
    try {
      const { data, error } = await supabase.functions.invoke<{ value: any | null; raw?: string }>(
        'enrich-submission',
        { body: { id: submission.id, field, table: 'activity_submissions' } },
      );
      if (error) throw error;
      const value = data?.value;
      const isEmpty =
        value == null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        setState('empty');
        setTimeout(() => setState('idle'), 3000);
      } else {
        setSuggestion(value);
        setState('result');
      }
    } catch (_e) {
      setState('empty');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  async function accept() {
    setState('saving');
    try {
      await onAccept(suggestion);
      // Au succès, le parent recharge les rows et l'EnrichField unmount
      // (champ rempli) — pas besoin de reset d'état si on reste monté.
      setState('idle');
      setSuggestion(null);
    } catch (_e) {
      // L'erreur est déjà affichée via toast côté parent.
      // On revient à l'état result pour permettre un retry ou rejet.
      setState('result');
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={search}
        className={`group inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-500 transition hover:border-brand-cyan hover:bg-brand-cyan/5 hover:text-brand-cyan ${
          compact ? 'text-xs' : 'text-sm'
        }`}
        title={`Chercher ${label.toLowerCase()} avec l'IA`}
      >
        <Sparkles size={compact ? 12 : 14} className="text-amber-500" />
        <span>Chercher avec l'IA</span>
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-cyan" />
        Recherche en cours…
      </div>
    );
  }

  if (state === 'saving') {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
        Sauvegarde…
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
        Pas d'information trouvée
      </div>
    );
  }

  // result
  let preview: string;
  if (Array.isArray(suggestion)) {
    preview = suggestion.join(', ');
  } else if (typeof suggestion === 'object' && suggestion !== null) {
    preview = JSON.stringify(suggestion);
  } else {
    preview = String(suggestion);
  }
  return (
    <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 break-words text-xs text-slate-800">{preview}</div>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={accept}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          <Check size={12} /> Accepter
        </button>
        <button
          onClick={() => {
            setState('idle');
            setSuggestion(null);
          }}
          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          Rejeter
        </button>
      </div>
    </div>
  );
}
