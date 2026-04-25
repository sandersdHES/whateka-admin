import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { ActivityForm, formToPayload } from '../components/ActivityForm';
import { useToast } from '../components/Toast';

type ScheduledItem = {
  id: number;
  title: string;
  location_name: string;
  category: string | null;
  activity_url: string | null;
  image_url: string | null;
  source: 'activity' | 'submission';
  update_frequency: string | null;
  last_updated_at: string | null;
  next_update_at: string | null;
  update_notes: string | null;
  status?: string;
  // tous les autres champs nécessaires au form
  description: string | null;
  latitude: number;
  longitude: number;
  duration_minutes: number;
  price_level: number | null;
  features: string[] | null;
  seasons: string[] | null;
  social_tags: string[] | null;
  is_indoor: boolean;
  is_outdoor: boolean | null;
  date_label?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  recurrence_type?: string | null;
  seasonal_months?: number[] | null;
  weekly_days?: number[] | null;
};

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'yearly', label: 'Annuelle' },
  { value: 'before_season', label: '2 semaines avant saison' },
  { value: 'manual', label: 'Manuelle (à la demande)' },
];

const FREQ_LABEL: Record<string, string> = Object.fromEntries(
  FREQUENCIES.map((f) => [f.value, f.label]),
);

const FREQ_DAYS: Record<string, number | null> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
  before_season: null, // calculé manuellement
  manual: null,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isOverdue(nextUpdate: string | null): boolean {
  if (!nextUpdate) return false;
  return new Date(nextUpdate) <= new Date();
}

export function Scheduled() {
  const [rows, setRows] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<ScheduledItem | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const filterCond = 'update_frequency.not.is.null';
    const [actRes, subRes] = await Promise.all([
      supabase.from('activities').select('*').or(filterCond),
      supabase
        .from('activity_submissions')
        .select('*')
        .or(filterCond)
        .neq('status', 'rejected'),
    ]);
    if (actRes.error) toast.error(actRes.error.message);
    if (subRes.error) toast.error(subRes.error.message);
    const acts = ((actRes.data as any[]) ?? []).map(
      (a) => ({ ...a, source: 'activity' as const }),
    );
    const subs = ((subRes.data as any[]) ?? []).map(
      (s) => ({ ...s, source: 'submission' as const }),
    );
    const merged = [...acts, ...subs].sort((a, b) => {
      // Tri : overdue d'abord, puis par next_update_at croissant
      const aOver = isOverdue(a.next_update_at);
      const bOver = isOverdue(b.next_update_at);
      if (aOver !== bOver) return aOver ? -1 : 1;
      const an = a.next_update_at ?? '9999-12-31';
      const bn = b.next_update_at ?? '9999-12-31';
      return an.localeCompare(bn);
    });
    setRows(merged as ScheduledItem[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'overdue') return isOverdue(r.next_update_at);
      if (filter !== 'all' && r.update_frequency !== filter) return false;
      return true;
    });
  }, [rows, search, filter]);

  const counts = useMemo(() => {
    const overdue = rows.filter((r) => isOverdue(r.next_update_at)).length;
    return { total: rows.length, overdue };
  }, [rows]);

  async function markUpdated(r: ScheduledItem) {
    const now = new Date();
    const nowIso = now.toISOString();
    let nextDate: string | null = null;
    const days = FREQ_DAYS[r.update_frequency ?? ''];
    if (days != null) {
      const next = new Date(now);
      next.setDate(next.getDate() + days);
      nextDate = next.toISOString().slice(0, 10);
    }
    const table = r.source === 'submission' ? 'activity_submissions' : 'activities';
    const { error } = await supabase
      .from(table)
      .update({ last_updated_at: nowIso, next_update_at: nextDate })
      .eq('id', r.id);
    if (error) toast.error(error.message);
    else toast.success('Mise à jour enregistrée.');
    await load();
  }

  async function handleSave(values: Parameters<typeof formToPayload>[0]) {
    if (!editing) return;
    const payload = formToPayload(values);
    const table = editing.source === 'submission' ? 'activity_submissions' : 'activities';
    const { error } = await supabase.from(table).update(payload).eq('id', editing.id);
    if (error) throw new Error(error.message);
    toast.success('Activité mise à jour.');
    setEditing(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">À tenir à jour</h1>
        <p className="text-sm text-slate-500">
          Activités planifiées pour rafraîchissement périodique. {counts.total} au total
          {counts.overdue > 0 ? ` · ${counts.overdue} en retard` : ''}.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            filter === 'all' ? 'bg-brand-cyan text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          <CalendarClock size={14} /> Toutes ({counts.total})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            filter === 'overdue' ? 'bg-rose-500 text-white shadow-sm' : 'bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50'
          }`}
        >
          <AlarmClock size={14} /> En retard ({counts.overdue})
        </button>
        {FREQUENCIES.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              filter === f.value ? 'bg-brand-cyan text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par titre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucune activité planifiée"
          description="Configure une fréquence de mise à jour sur une activité pour la voir apparaître ici."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Activité</th>
                <th className="px-4 py-3">Fréquence</th>
                <th className="px-4 py-3">Dernière maj</th>
                <th className="px-4 py-3">Prochaine maj</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const overdue = isOverdue(r.next_update_at);
                return (
                  <tr key={`${r.source}-${r.id}`} className={`hover:bg-slate-50/60 ${overdue ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{r.title}</div>
                      <div className="text-xs text-slate-500">
                        #{r.id} · {r.location_name}
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            r.source === 'submission'
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          {r.source === 'submission' ? 'Soumission' : 'Validée'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {FREQ_LABEL[r.update_frequency ?? ''] ?? r.update_frequency ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(r.last_updated_at)}</td>
                    <td className="px-4 py-3">
                      <span className={overdue ? 'font-semibold text-rose-700' : 'text-slate-700'}>
                        {formatDate(r.next_update_at)}
                      </span>
                      {overdue && <span className="ml-1 text-xs text-rose-600">⚠ en retard</span>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-slate-500">
                      {r.update_notes ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {r.activity_url && (
                          <a
                            href={r.activity_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Ouvrir le site"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => markUpdated(r)}
                          className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                          title="Marquer comme mis à jour"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Éditer"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Éditer l'activité"
        maxWidth="max-w-4xl"
      >
        {editing && (
          <ActivityForm
            initial={editing as any}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            submitLabel="Mettre à jour"
          />
        )}
      </Modal>
    </div>
  );
}
