import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Pencil, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ActivitySubmission } from '../lib/types';
import { categoryLabel, formatDate, formatDuration } from '../lib/format';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { ActivityForm, formToPayload } from '../components/ActivityForm';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';

type Tab = 'pending' | 'all';

export function Submissions() {
  const [rows, setRows] = useState<ActivitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ActivitySubmission | null>(null);
  const [rejecting, setRejecting] = useState<ActivitySubmission | null>(null);
  const [rejectNote, setRejectNote] = useState('');
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
    return rows.filter((r) => {
      if (tab === 'pending' && r.status !== 'pending') return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, tab, search]);

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

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
    if (!confirm(`Approuver « ${s.title} » ? Elle sera copiée dans les activités publiques.`)) return;
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
          {pendingCount} soumission{pendingCount > 1 ? 's' : ''} en attente.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="inline-flex overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          {(['pending', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === t ? 'bg-brand-cyan text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t === 'pending' ? `En attente (${pendingCount})` : 'Toutes'}
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
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucune soumission" description="Rien à traiter pour le moment." />
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
                          ? 'bg-amber-100 text-amber-800'
                          : s.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {s.status === 'pending' ? 'En attente' : s.status === 'approved' ? 'Approuvée' : 'Rejetée'}
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
                      {s.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(s)}
                            className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Approuver"
                          >
                            <Check size={16} />
                          </button>
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
