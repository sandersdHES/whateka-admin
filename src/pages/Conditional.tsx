import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Activity } from '../lib/types';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { ActivityForm, formToPayload } from '../components/ActivityForm';
import { useToast } from '../components/Toast';

type ConditionalActivity = Activity & {
  date_label: string | null;
  date_start: string | null;
  date_end: string | null;
  recurrence_type: 'one_off' | 'weekly' | 'seasonal' | null;
  seasonal_months: number[] | null;
  weekly_days: number[] | null;
};

type FilterTab = 'all' | 'active' | 'upcoming' | 'expired' | 'weekly' | 'seasonal';

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function durationDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return daysBetween(new Date(start), new Date(end)) + 1;
}

/**
 * Détermine si une activité doit être proposée maintenant.
 * - one_off ≤ 7j : proposable 21j avant date_end jusqu'à date_end
 * - one_off > 7j et < 30j : proposable 21j avant date_start jusqu'à date_end
 * - one_off ≥ 30j : proposable entre date_start et date_end
 * - seasonal : proposable si mois courant ∈ seasonal_months
 * - weekly : toujours proposable
 */
function isProposableNow(a: ConditionalActivity, now: Date): boolean {
  if (!a.recurrence_type) return true;
  if (a.recurrence_type === 'weekly') {
    // v25 : weekly = visible uniquement le jour de la semaine indique.
    if (Array.isArray(a.weekly_days) && a.weekly_days.length > 0) {
      return a.weekly_days.includes(now.getDay());
    }
    return true;
  }
  if (a.recurrence_type === 'seasonal') {
    const month = now.getMonth() + 1;
    return (a.seasonal_months ?? []).includes(month);
  }
  if (a.recurrence_type === 'one_off') {
    if (!a.date_start || !a.date_end) return true;
    const start = new Date(a.date_start);
    const end = new Date(a.date_end);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
    const dur = durationDays(a.date_start, a.date_end) ?? 0;
    if (dur <= 7) {
      const window = new Date(end);
      window.setDate(window.getDate() - 21);
      return now >= window;
    }
    if (dur < 30) {
      const window = new Date(start);
      window.setDate(window.getDate() - 21);
      return now >= window;
    }
    return now >= start;
  }
  return true;
}

function isExpired(a: ConditionalActivity, now: Date): boolean {
  if (a.recurrence_type !== 'one_off') return false;
  if (!a.date_end) return false;
  const end = new Date(a.date_end);
  end.setHours(23, 59, 59, 999);
  return now > end;
}

function isUpcoming(a: ConditionalActivity, now: Date): boolean {
  if (a.recurrence_type !== 'one_off') return false;
  if (!a.date_start) return false;
  const start = new Date(a.date_start);
  return now < start && !isProposableNow(a, now);
}

function statusLabel(a: ConditionalActivity, now: Date): { label: string; cls: string } {
  if (isExpired(a, now)) return { label: 'Échue', cls: 'bg-rose-100 text-rose-800' };
  if (isProposableNow(a, now)) return { label: 'Proposée maintenant', cls: 'bg-emerald-100 text-emerald-800' };
  if (a.recurrence_type === 'one_off' && isUpcoming(a, now))
    return { label: 'À venir (en attente fenêtre)', cls: 'bg-sky-100 text-sky-800' };
  if (a.recurrence_type === 'seasonal') return { label: 'Hors saison', cls: 'bg-amber-100 text-amber-800' };
  return { label: '—', cls: 'bg-slate-100 text-slate-600' };
}

function recurrenceBadge(a: ConditionalActivity): { label: string; cls: string } {
  switch (a.recurrence_type) {
    case 'one_off':
      return { label: 'Ponctuel', cls: 'bg-purple-100 text-purple-800' };
    case 'weekly':
      return { label: 'Hebdo', cls: 'bg-indigo-100 text-indigo-800' };
    case 'seasonal':
      return { label: 'Saisonnier', cls: 'bg-teal-100 text-teal-800' };
    default:
      return { label: '—', cls: 'bg-slate-100 text-slate-600' };
  }
}

function detailLine(a: ConditionalActivity): string {
  if (a.date_label) return a.date_label;
  if (a.recurrence_type === 'one_off' && a.date_start && a.date_end)
    return `${a.date_start} → ${a.date_end}`;
  if (a.recurrence_type === 'weekly' && a.weekly_days?.length)
    return a.weekly_days.map((d) => WEEKDAYS[d] ?? '?').join(', ');
  if (a.recurrence_type === 'seasonal' && a.seasonal_months?.length)
    return a.seasonal_months.map((m) => MONTHS[m - 1] ?? '?').join(', ');
  return '—';
}

export function Conditional() {
  const [rows, setRows] = useState<ConditionalActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('active');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ConditionalActivity | null>(null);
  const toast = useToast();

  const now = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .or('recurrence_type.not.is.null,date_label.not.is.null,date_start.not.is.null')
      .order('date_end', { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data as ConditionalActivity[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let expired = 0;
    let weekly = 0;
    let seasonal = 0;
    for (const a of rows) {
      if (isExpired(a, now)) expired++;
      else if (isProposableNow(a, now)) active++;
      else if (a.recurrence_type === 'one_off') upcoming++;
      if (a.recurrence_type === 'weekly') weekly++;
      if (a.recurrence_type === 'seasonal') seasonal++;
    }
    return { total: rows.length, active, upcoming, expired, weekly, seasonal };
  }, [rows, now]);

  // Calcule pour chaque semaine de l'année en cours combien d'activités à
  // condition seraient proposables (selon la même logique que isProposableNow).
  const weeklyHeatmap = useMemo(() => {
    const year = now.getFullYear();
    // Premier lundi de l'année (ou 1er jan si lundi). On part du 1er janvier
    // et on ajoute 7j à chaque itération — l'index correspond à la semaine ISO approx.
    const start = new Date(year, 0, 1);
    const startDay = start.getDay(); // 0=dim..6=sam
    // On veut commencer un lundi : décale au prochain lundi (ou recule au lundi précédent).
    const offsetToMonday = startDay === 0 ? -6 : 1 - startDay;
    start.setDate(start.getDate() + offsetToMonday);
    const weeks: { weekIndex: number; weekStart: Date; count: number }[] = [];
    for (let w = 0; w < 52; w++) {
      const ws = new Date(start);
      ws.setDate(ws.getDate() + w * 7);
      // Sample: milieu de la semaine (mercredi midi) pour stabilité.
      const sample = new Date(ws);
      sample.setDate(sample.getDate() + 2);
      sample.setHours(12, 0, 0, 0);
      let count = 0;
      for (const a of rows) {
        if (isExpired(a, sample)) continue;
        if (isProposableNow(a, sample)) count++;
      }
      weeks.push({ weekIndex: w, weekStart: ws, count });
    }
    const maxCount = weeks.reduce((m, w) => Math.max(m, w.count), 0);
    const currentWeekIdx = (() => {
      const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
      return Math.max(0, Math.min(51, Math.floor(diffDays / 7)));
    })();
    return { weeks, maxCount, currentWeekIdx };
  }, [rows, now]);

  const filtered = useMemo(() => {
    return rows.filter((a) => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      switch (tab) {
        case 'active':
          return !isExpired(a, now) && isProposableNow(a, now);
        case 'upcoming':
          return !isExpired(a, now) && !isProposableNow(a, now) && a.recurrence_type === 'one_off';
        case 'expired':
          return isExpired(a, now);
        case 'weekly':
          return a.recurrence_type === 'weekly';
        case 'seasonal':
          return a.recurrence_type === 'seasonal';
        case 'all':
        default:
          return true;
      }
    });
  }, [rows, tab, search, now]);

  async function handleSave(values: Parameters<typeof formToPayload>[0]) {
    if (!editing) return;
    const payload = formToPayload(values);
    const { error } = await supabase.from('activities').update(payload).eq('id', editing.id);
    if (error) throw new Error(error.message);
    toast.success('Activité mise à jour.');
    setEditing(null);
    await load();
  }

  async function handleReprogram(a: ConditionalActivity) {
    if (a.recurrence_type !== 'one_off' || !a.date_start || !a.date_end) {
      toast.error('Reprogrammation possible uniquement pour les événements ponctuels avec dates.');
      return;
    }
    if (!confirm(`Reprogrammer « ${a.title} » à l'année suivante (${a.date_start} → ${a.date_end} +1 an) ?`))
      return;
    const start = new Date(a.date_start);
    const end = new Date(a.date_end);
    start.setFullYear(start.getFullYear() + 1);
    end.setFullYear(end.getFullYear() + 1);
    const newStart = start.toISOString().slice(0, 10);
    const newEnd = end.toISOString().slice(0, 10);
    // Mettre à jour date_label : remplace l'année si trouvée
    const yearOld = String(new Date(a.date_start).getFullYear());
    const yearNew = String(start.getFullYear());
    const newLabel = a.date_label?.includes(yearOld)
      ? a.date_label.split(yearOld).join(yearNew)
      : a.date_label;
    const { error } = await supabase
      .from('activities')
      .update({ date_start: newStart, date_end: newEnd, date_label: newLabel })
      .eq('id', a.id);
    if (error) toast.error(error.message);
    else toast.success('Activité reprogrammée à l\'année suivante.');
    await load();
  }

  async function handleDelete(a: ConditionalActivity) {
    if (!confirm(`Supprimer définitivement « ${a.title} » ?`)) return;
    const { error } = await supabase.from('activities').delete().eq('id', a.id);
    if (error) toast.error(error.message);
    else toast.success('Activité supprimée.');
    await load();
  }

  const tabs: { value: FilterTab; label: string; count: number; icon: any }[] = [
    { value: 'active', label: 'Proposées maintenant', count: counts.active, icon: CheckCircle2 },
    { value: 'upcoming', label: 'À venir', count: counts.upcoming, icon: Clock },
    { value: 'expired', label: 'Échues', count: counts.expired, icon: CalendarX },
    { value: 'weekly', label: 'Hebdo', count: counts.weekly, icon: RefreshCw },
    { value: 'seasonal', label: 'Saisonnières', count: counts.seasonal, icon: CalendarClock },
    { value: 'all', label: 'Toutes', count: counts.total, icon: CalendarClock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activités à condition</h1>
        <p className="text-sm text-slate-500">
          Activités ayant une contrainte temporelle (date, récurrence, saison).
        </p>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <DashCard label="Total" value={counts.total} cls="bg-slate-100 text-slate-700" />
        <DashCard label="Proposées" value={counts.active} cls="bg-emerald-100 text-emerald-800" />
        <DashCard label="À venir" value={counts.upcoming} cls="bg-sky-100 text-sky-800" />
        <DashCard label="Échues" value={counts.expired} cls="bg-rose-100 text-rose-800" />
        <DashCard label="Hebdo" value={counts.weekly} cls="bg-indigo-100 text-indigo-800" />
        <DashCard label="Saisonnières" value={counts.seasonal} cls="bg-teal-100 text-teal-800" />
      </div>

      {/* Heatmap 52 semaines */}
      <WeeklyChart
        weeks={weeklyHeatmap.weeks}
        max={weeklyHeatmap.maxCount}
        currentWeekIdx={weeklyHeatmap.currentWeekIdx}
        year={now.getFullYear()}
      />

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ value, label, count, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === value
                ? 'bg-brand-cyan text-white shadow-sm'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} />
            {label} ({count})
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

      {/* Tableau */}
      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucune activité"
          description="Aucune activité ne correspond aux critères. Va dans 'Activités' et coche 'Horaires restreints' pour qu'elle apparaisse ici."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Activité</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Quand</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => {
                const rec = recurrenceBadge(a);
                const st = statusLabel(a, now);
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{a.title}</div>
                      <div className="text-xs text-slate-500">
                        #{a.id} · {a.location_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${rec.cls}`}>{rec.label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{detailLine(a)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {a.activity_url && (
                          <a
                            href={a.activity_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Ouvrir le site"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => setEditing(a)}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Éditer"
                        >
                          <Pencil size={16} />
                        </button>
                        {isExpired(a, now) && a.recurrence_type === 'one_off' && (
                          <button
                            onClick={() => handleReprogram(a)}
                            className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Reprogrammer +1 an"
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(a)}
                          className="rounded-md p-2 text-rose-500 hover:bg-rose-50"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
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
            initial={editing}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            submitLabel="Mettre à jour"
          />
        )}
      </Modal>
    </div>
  );
}

function DashCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl p-4 ${cls}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function WeeklyChart({
  weeks,
  max,
  currentWeekIdx,
  year,
}: {
  weeks: { weekIndex: number; weekStart: Date; count: number }[];
  max: number;
  currentWeekIdx: number;
  year: number;
}) {
  // Marqueurs de mois : on capture le premier index de semaine de chaque mois
  const monthMarkers: { idx: number; label: string }[] = [];
  let lastMonth = -1;
  for (const w of weeks) {
    const m = w.weekStart.getMonth();
    if (m !== lastMonth) {
      monthMarkers.push({
        idx: w.weekIndex,
        label: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'][m],
      });
      lastMonth = m;
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Disponibilité par semaine</div>
          <div className="text-xs text-slate-500">
            Nombre d'activités proposables chaque semaine de {year}
            {max > 0 ? ` · pic : ${max}` : ''}
          </div>
        </div>
        <div className="text-xs text-slate-500">52 semaines</div>
      </div>
      <div className="relative">
        <div className="flex h-28 items-end gap-[3px]">
          {weeks.map((w) => {
            const ratio = max > 0 ? w.count / max : 0;
            const heightPct = w.count > 0 ? Math.max(8, ratio * 100) : 2;
            const isCurrent = w.weekIndex === currentWeekIdx;
            const tooltip = `S${w.weekIndex + 1} (${w.weekStart.toLocaleDateString('fr-CH', {
              day: '2-digit',
              month: 'short',
            })}) — ${w.count} activité${w.count > 1 ? 's' : ''}`;
            return (
              <div
                key={w.weekIndex}
                className="group relative flex-1"
                title={tooltip}
              >
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    isCurrent
                      ? 'bg-brand-cyan'
                      : w.count === 0
                        ? 'bg-slate-100'
                        : 'bg-emerald-400 group-hover:bg-emerald-500'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex text-[10px] text-slate-400">
          {weeks.map((w) => {
            const marker = monthMarkers.find((m) => m.idx === w.weekIndex);
            return (
              <div key={w.weekIndex} className="flex-1 text-center">
                {marker ? marker.label : ''}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          <span>Semaine standard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-cyan" />
          <span>Semaine actuelle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-100 ring-1 ring-slate-200" />
          <span>Aucune activité</span>
        </div>
      </div>
    </div>
  );
}
