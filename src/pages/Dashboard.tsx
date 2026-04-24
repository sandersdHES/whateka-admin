import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Activity, AlertTriangle, Heart, Inbox, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORIES, CATEGORY_COLORS } from '../lib/types';
import { Stat } from '../components/ui/Stat';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/Toast';

type Stats = {
  activities: number;
  pending: number;
  feedbacks: number;
  favorites: number;
  byCategory: { name: string; value: number; color: string }[];
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [act, pend, fb, fav, cats] = await Promise.all([
          supabase.from('activities').select('*', { count: 'exact', head: true }),
          supabase
            .from('activity_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase.from('feedback_submissions').select('*', { count: 'exact', head: true }),
          supabase.from('favorites').select('*', { count: 'exact', head: true }),
          supabase.from('activities').select('category'),
        ]);

        const counts = new Map<string, number>();
        for (const row of cats.data ?? []) {
          const raw = (row as { category: string | null }).category ?? '';
          for (const c of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
            counts.set(c, (counts.get(c) ?? 0) + 1);
          }
        }
        const byCategory = CATEGORIES.map((c) => ({
          name: c.label,
          value: counts.get(c.value) ?? 0,
          color: CATEGORY_COLORS[c.value] ?? '#64748b',
        })).filter((x) => x.value > 0);

        setStats({
          activities: act.count ?? 0,
          pending: pend.count ?? 0,
          feedbacks: fb.count ?? 0,
          favorites: fav.count ?? 0,
          byCategory,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  if (loading || !stats) return <Loader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue d'ensemble de la plateforme Whateka.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Activités totales" value={stats.activities} icon={Activity} accent="cyan" />
        <Stat label="Soumissions en attente" value={stats.pending} icon={Inbox} accent="orange" />
        <Stat label="Feedbacks reçus" value={stats.feedbacks} icon={MessageSquare} accent="green" />
        <Stat label="Favoris totaux" value={stats.favorites} icon={Heart} accent="yellow" />
      </div>

      {stats.pending > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange ring-1 ring-brand-orange/20">
          <AlertTriangle size={18} />
          <span>
            <strong>{stats.pending}</strong> soumission{stats.pending > 1 ? 's' : ''} en attente de validation.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Activités par catégorie</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byCategory}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stats.byCategory.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Répartition des catégories</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byCategory}
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stats.byCategory.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
