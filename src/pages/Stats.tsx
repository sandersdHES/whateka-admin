import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/Toast';
import { CATEGORIES, CATEGORY_COLORS } from '../lib/types';

type RawActivity = { id: number; title: string; category: string | null; created_at: string };
type RawSubmission = { created_at: string };
type RawFavorite = { activity_id: number };

export function Stats() {
  const [activities, setActivities] = useState<RawActivity[]>([]);
  const [submissions, setSubmissions] = useState<RawSubmission[]>([]);
  const [favorites, setFavorites] = useState<RawFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [a, s, f] = await Promise.all([
          supabase.from('activities').select('id,title,category,created_at'),
          supabase.from('activity_submissions').select('created_at'),
          supabase.from('favorites').select('activity_id'),
        ]);
        if (a.error) throw a.error;
        if (s.error) throw s.error;
        if (f.error) throw f.error;
        setActivities((a.data as RawActivity[]) ?? []);
        setSubmissions((s.data as RawSubmission[]) ?? []);
        setFavorites((f.data as RawFavorite[]) ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur chargement.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const activitiesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of activities) {
      const d = new Date(a.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [activities]);

  const submissionsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [submissions]);

  const topFavorites = useMemo(() => {
    const counts = new Map<number, number>();
    for (const f of favorites) counts.set(f.activity_id, (counts.get(f.activity_id) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        count,
        title: activities.find((a) => a.id === id)?.title ?? `#${id}`,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [favorites, activities]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of activities) {
      for (const c of (a.category ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return CATEGORIES.map((c) => ({
      name: c.label,
      value: counts.get(c.value) ?? 0,
      color: CATEGORY_COLORS[c.value] ?? '#64748b',
    })).filter((x) => x.value > 0);
  }, [activities]);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Statistiques</h1>
        <p className="text-sm text-slate-500">Analyses détaillées de la plateforme.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Activités ajoutées par mois</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activitiesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#00B8D9" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Soumissions par mois</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={submissionsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#FF6F61" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Top 10 favoris</h2>
          {topFavorites.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun favori pour le moment.</p>
          ) : (
            <ol className="space-y-2">
              {topFavorites.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-cyan/10 text-xs font-semibold text-brand-cyan">
                      {i + 1}
                    </span>
                    {t.title}
                  </span>
                  <span className="font-semibold text-slate-900">{t.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Catégories</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryCounts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#00B8D9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
