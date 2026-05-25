import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Check, Eye, Mail, MailOpen, MessageSquare, Reply } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';

type Status = 'new' | 'read' | 'responded' | 'archived';

type ContactMessage = {
  id: number;
  created_at: string;
  user_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  subject: string;
  message: string;
  status: Status;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string | null;
};

type Tab = 'new' | 'all' | 'responded' | 'archived';

const TAB_LABEL: Record<Tab, string> = {
  new: 'Nouveaux',
  all: 'Tous',
  responded: 'Répondus',
  archived: 'Archivés',
};

const STATUS_BADGE: Record<Status, string> = {
  new: 'bg-sky-100 text-sky-800',
  read: 'bg-slate-100 text-slate-700',
  responded: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-100 text-slate-500',
};

const STATUS_LABEL: Record<Status, string> = {
  new: 'Nouveau',
  read: 'Lu',
  responded: 'Répondu',
  archived: 'Archivé',
};

export function Messages() {
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('new');
  const [open, setOpen] = useState<ContactMessage | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const toast = useToast();
  const { adminProfile } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as ContactMessage[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab === 'new') return r.status === 'new' || r.status === 'read';
      if (tab === 'responded') return r.status === 'responded';
      if (tab === 'archived') return r.status === 'archived';
      return true; // 'all'
    });
  }, [rows, tab]);

  const counts = useMemo(
    () => ({
      new: rows.filter((r) => r.status === 'new').length,
      responded: rows.filter((r) => r.status === 'responded').length,
      archived: rows.filter((r) => r.status === 'archived').length,
      total: rows.length,
    }),
    [rows],
  );

  async function updateStatus(msg: ContactMessage, status: Status) {
    const { error } = await supabase
      .from('contact_messages')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile?.email ?? null,
      })
      .eq('id', msg.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Message marqué « ${STATUS_LABEL[status].toLowerCase()} ».`);
    await load();
    if (open?.id === msg.id) {
      setOpen({ ...open, status });
    }
  }

  async function saveAdminNotes() {
    if (!open) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('contact_messages')
      .update({ admin_notes: adminNotes.trim() || null })
      .eq('id', open.id);
    setSavingNotes(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Notes enregistrées.');
    setOpen({ ...open, admin_notes: adminNotes.trim() || null });
    setRows((rs) =>
      rs.map((r) =>
        r.id === open.id ? { ...r, admin_notes: adminNotes.trim() || null } : r,
      ),
    );
  }

  function openMessage(msg: ContactMessage) {
    setOpen(msg);
    setAdminNotes(msg.admin_notes ?? '');
    // Si nouveau, marque comme lu auto
    if (msg.status === 'new') {
      void updateStatus(msg, 'read');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-sm text-slate-500">
            Messages envoyés par les utilisateurs depuis le profil de l'app.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sm text-sky-700 ring-1 ring-sky-100">
          <Mail size={14} />
          <span className="font-semibold">{counts.new}</span>
          <span>nouveaux</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => {
          const active = t === tab;
          let count = 0;
          if (t === 'new') count = counts.new;
          else if (t === 'responded') count = counts.responded;
          else if (t === 'archived') count = counts.archived;
          else count = counts.total;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-brand-cyan text-white shadow-sm'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {TAB_LABEL[t]}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun message"
          description={
            tab === 'new'
              ? 'Tous les messages ont été traités. 🎉'
              : 'Rien à afficher dans cet onglet.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Expéditeur</th>
                <th className="px-4 py-3">Sujet</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDateTime(m.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {m.sender_name ?? '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {m.sender_email ?? 'anonyme'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openMessage(m)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        title="Voir le message"
                      >
                        <Eye size={16} />
                      </button>
                      {m.status !== 'responded' && (
                        <button
                          onClick={() => updateStatus(m, 'responded')}
                          className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                          title="Marquer comme répondu"
                        >
                          <Reply size={16} />
                        </button>
                      )}
                      {m.status !== 'archived' && (
                        <button
                          onClick={() => updateStatus(m, 'archived')}
                          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                          title="Archiver"
                        >
                          <Archive size={16} />
                        </button>
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
        open={open !== null}
        onClose={() => setOpen(null)}
        title="Message"
        maxWidth="max-w-2xl"
      >
        {open && (
          <div className="space-y-5">
            {/* Sender + métadonnées */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">
                    {open.sender_name ?? 'Sans nom'}
                  </div>
                  <div className="text-sm text-slate-600">
                    {open.sender_email ?? 'anonyme'}
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[open.status]}`}>
                  {STATUS_LABEL[open.status]}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Envoyé le {formatDateTime(open.created_at)}
                {open.reviewed_at && open.reviewed_by && (
                  <span>
                    {' · '}Traité par {open.reviewed_by} le{' '}
                    {formatDateTime(open.reviewed_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Sujet */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sujet
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {open.subject}
              </div>
            </div>

            {/* Message */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Message
              </div>
              <div className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm text-slate-800 ring-1 ring-slate-100">
                {open.message}
              </div>
            </div>

            {/* Notes admin */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notes internes (invisible pour l'utilisateur)
              </div>
              <textarea
                className="input min-h-[80px] w-full"
                placeholder="Ex: répondu sur Instagram le 12 mai, bug confirmé, etc."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={saveAdminNotes}
                  disabled={savingNotes}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-cyan/90 disabled:opacity-50"
                >
                  <Check size={14} />
                  Enregistrer les notes
                </button>
              </div>
            </div>

            {/* Actions principales */}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {open.sender_email && (
                <a
                  href={`mailto:${open.sender_email}?subject=Re: ${encodeURIComponent(open.subject)}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white hover:bg-brand-cyan/90"
                >
                  <Reply size={16} />
                  Répondre par email
                </a>
              )}
              {open.status !== 'responded' && (
                <button
                  onClick={() => updateStatus(open, 'responded')}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-200"
                >
                  <MailOpen size={16} />
                  Marquer comme répondu
                </button>
              )}
              {open.status !== 'archived' && (
                <button
                  onClick={() => updateStatus(open, 'archived')}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Archive size={16} />
                  Archiver
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Empêche le warning import inutilisé pour MessageSquare/Mail (utilisés dans icon ailleurs)
void MessageSquare;
