import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORIES, type Activity } from '../lib/types';
import { categoryLabel, formatDuration, toIndoorOutdoorLabel } from '../lib/format';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { ActivityForm, formToPayload } from '../components/ActivityForm';
import { useToast } from '../components/Toast';

export function Activities() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Activity[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (category && !(r.category ?? '').split(',').map((s) => s.trim()).includes(category)) return false;
      return true;
    });
  }, [rows, search, category]);

  async function handleSave(values: Parameters<typeof formToPayload>[0]) {
    const payload = formToPayload(values);
    if (editing === 'new') {
      const { error } = await supabase.from('activities').insert(payload);
      if (error) throw new Error(error.message);
      toast.success('Activité créée.');
    } else if (editing) {
      const { error } = await supabase.from('activities').update(payload).eq('id', editing.id);
      if (error) throw new Error(error.message);
      toast.success('Activité mise à jour.');
    }
    setEditing(null);
    await load();
  }

  async function handleDelete(a: Activity) {
    if (!confirm(`Supprimer « ${a.title} » ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from('activities').delete().eq('id', a.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Activité supprimée.');
      await load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activités</h1>
          <p className="text-sm text-slate-500">
            {rows.length} activité{rows.length > 1 ? 's' : ''} dans la base.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} />
          Nouvelle activité
        </button>
      </div>

      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par titre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input max-w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucune activité" description="Ajuste les filtres ou crée une nouvelle activité." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Activité</th>
                <th className="px-4 py-3">Lieu</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {a.image_url ? (
                        <img
                          src={a.image_url}
                          alt=""
                          className="h-10 w-14 shrink-0 rounded-md object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                        />
                      ) : (
                        <div className="h-10 w-14 shrink-0 rounded-md bg-slate-100" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">{a.title}</div>
                        <div className="text-xs text-slate-500">
                          #{a.id} · {categoryLabel(a.category)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{a.location_name}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDuration(a.duration_minutes)}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-slate-100 text-slate-700">
                      {toIndoorOutdoorLabel(a.is_indoor, a.is_outdoor)}
                    </span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvelle activité' : 'Éditer l\'activité'}
        maxWidth="max-w-4xl"
      >
        {editing !== null && (
          <ActivityForm
            initial={editing === 'new' ? undefined : editing}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            submitLabel={editing === 'new' ? 'Créer' : 'Mettre à jour'}
          />
        )}
      </Modal>
    </div>
  );
}
