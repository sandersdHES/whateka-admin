import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserRow } from '../lib/types';
import { formatDate, formatDateTime } from '../lib/format';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/Toast';

export function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('admin-list-users');
        if (error) throw error;
        setRows(((data as { users?: UserRow[] })?.users ?? []) as UserRow[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur chargement utilisateurs.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        (u.first_name ?? '').toLowerCase().includes(s),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Utilisateurs</h1>
        <p className="text-sm text-slate-500">
          {rows.length} utilisateur{rows.length > 1 ? 's' : ''} inscrit{rows.length > 1 ? 's' : ''}.
        </p>
      </div>

      <div className="card">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par prénom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun utilisateur" description="Vérifie que l'Edge Function admin-list-users est bien déployée." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Inscription</th>
                <th className="px-4 py-3">Dernière connexion</th>
                <th className="px-4 py-3 text-right">Questionnaires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.first_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{u.questionnaires_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
