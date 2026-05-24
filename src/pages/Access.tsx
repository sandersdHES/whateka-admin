import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Key, KeyRound, Mail, Sparkles, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';

type AllowlistEntry = {
  email: string;
  granted_at: string;
  granted_by: string | null;
  note: string | null;
};

type CodeUser = {
  id: string;
  email: string;
  access_via_code: boolean;
  last_sign_in_at: string | null;
  created_at: string;
};

type PromoRedemption = {
  user_id: string;
  email: string | null;
  code: string;
  tier: string;
  duration_months: number;
  redeemed_at: string;
  expires_at: string | null;
  status: string | null;
  seconds_remaining: number | null;
};

function formatTimeRemaining(seconds: number | null): { label: string; tone: 'ok' | 'warn' | 'expired' } {
  if (seconds === null || seconds === undefined) {
    return { label: '—', tone: 'ok' };
  }
  if (seconds <= 0) {
    return { label: 'Expiré', tone: 'expired' };
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const tone = days <= 7 ? 'warn' : 'ok';
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remDays = days % 30;
    return { label: `${months} mois ${remDays}j`, tone };
  }
  if (days >= 1) {
    return { label: `${days}j ${hours}h`, tone };
  }
  return { label: `${hours}h`, tone: 'warn' };
}

function promoCodeBadgeClass(code: string): string {
  switch (code) {
    case 'WHATEKA2026':
      return 'bg-purple-100 text-purple-800';
    case 'WA2026':
      return 'bg-brand-cyan/15 text-cyan-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function Access() {
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [codeUsers, setCodeUsers] = useState<CodeUser[]>([]);
  const [promoRedemptions, setPromoRedemptions] = useState<PromoRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const { adminProfile } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, fRes, pRes] = await Promise.all([
      supabase.from('app_access').select('*').order('granted_at', { ascending: true }),
      supabase.functions.invoke<{ users: CodeUser[] }>('admin-access-users'),
      supabase.rpc('list_promo_redemptions_admin'),
    ]);
    if (aRes.error) toast.error(aRes.error.message);
    if (fRes.error) toast.error(`code-users: ${fRes.error.message}`);
    if (pRes.error) toast.error(`promo: ${pRes.error.message}`);
    setAllowlist((aRes.data as AllowlistEntry[]) ?? []);
    setCodeUsers((fRes.data?.users as CodeUser[]) ?? []);
    setPromoRedemptions((pRes.data as PromoRedemption[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Email invalide.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('app_access').insert({
      email,
      granted_by: adminProfile?.email ?? null,
      note: newNote.trim() || null,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Email ajouté à la liste blanche.');
      setNewEmail('');
      setNewNote('');
      await load();
    }
  }

  async function handleRemoveAllowlist(email: string) {
    if (!confirm(`Retirer ${email} de la liste blanche ?`)) return;
    const { error } = await supabase.from('app_access').delete().eq('email', email);
    if (error) toast.error(error.message);
    else toast.success('Email retiré.');
    await load();
  }

  async function handleRevokeCode(u: CodeUser) {
    if (!confirm(`Révoquer l'accès code de ${u.email} ?`)) return;
    const { error } = await supabase.functions.invoke('admin-revoke-code-access', {
      body: { user_id: u.id },
    });
    if (error) toast.error(error.message);
    else toast.success('Accès révoqué.');
    await load();
  }

  const counts = useMemo(
    () => ({
      allowlist: allowlist.length,
      codeUsers: codeUsers.length,
      promo: promoRedemptions.length,
      promoActive: promoRedemptions.filter((r) => (r.seconds_remaining ?? 0) > 0).length,
    }),
    [allowlist, codeUsers, promoRedemptions],
  );

  const promoCounts = useMemo(() => {
    const byCode: Record<string, number> = {};
    for (const r of promoRedemptions) {
      byCode[r.code] = (byCode[r.code] ?? 0) + 1;
    }
    return byCode;
  }, [promoRedemptions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accès</h1>
        <p className="text-sm text-slate-500">
          Liste blanche bêta, utilisateurs via code d'accès et abonnés via codes promo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <UserCheck size={14} /> Liste blanche
          </div>
          <div className="mt-1 text-3xl font-bold text-emerald-900">{counts.allowlist}</div>
          <div className="text-xs text-emerald-700/80">invités directs (email)</div>
        </div>
        <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <KeyRound size={14} /> Connectés via code
          </div>
          <div className="mt-1 text-3xl font-bold text-amber-900">{counts.codeUsers}</div>
          <div className="text-xs text-amber-700/80">ont saisi le code WLMDY26</div>
        </div>
        <div className="rounded-2xl bg-brand-cyan/10 p-5 ring-1 ring-brand-cyan/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            <Gift size={14} /> Codes promo (Premium)
          </div>
          <div className="mt-1 text-3xl font-bold text-cyan-900">
            {counts.promoActive}
            <span className="ml-2 text-sm font-normal text-cyan-700">
              / {counts.promo} total
            </span>
          </div>
          <div className="text-xs text-cyan-700/80">
            {Object.entries(promoCounts)
              .map(([code, n]) => `${code}: ${n}`)
              .join(' · ') || 'aucune redemption'}
          </div>
        </div>
      </div>

      {/* Section 1 : Allowlist */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Liste blanche (invités directs)</h2>
        </div>

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 p-5 md:flex-row md:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                type="email"
                placeholder="email@exemple.ch"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-700">Note (optionnel)</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: testeuse beta, ami, ..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newEmail}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-cyan px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-cyan/90 disabled:opacity-50"
          >
            <UserPlus size={16} />
            Ajouter
          </button>
        </form>

        {loading ? (
          <Loader />
        ) : allowlist.length === 0 ? (
          <EmptyState title="Aucun invité" description="Ajoute un email pour donner l'accès à un testeur." />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3">Par</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allowlist.map((a) => (
                <tr key={a.email} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{a.email}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(a.granted_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{a.granted_by ?? '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-500">{a.note ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRemoveAllowlist(a.email)}
                        className="rounded-md p-2 text-rose-500 hover:bg-rose-50"
                        title="Retirer de la liste"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2 : Code users (WLMDY26 beta access code) */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="inline-flex items-center gap-2">
              <Key size={14} className="text-amber-600" /> Connectés via code d'accès bêta
            </span>
          </h2>
          <span className="text-xs text-slate-500">badge 🔑 ambre = utilise le code WLMDY26</span>
        </div>
        {loading ? (
          <Loader />
        ) : codeUsers.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur via code"
            description="Personne n'a encore saisi le code d'accès."
          />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Compte créé</th>
                <th className="px-4 py-3">Dernière connexion</th>
                <th className="px-4 py-3">Origine</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codeUsers.map((u) => (
                <tr key={u.id} className="bg-amber-50/30 hover:bg-amber-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(u.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.access_via_code ? (
                      <span className="badge bg-amber-100 text-amber-800">🔑 Code WLMDY26</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-700">Manuel</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRevokeCode(u)}
                        className="rounded-md p-2 text-rose-500 hover:bg-rose-50"
                        title="Révoquer l'accès"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3 : Codes promo (Premium) — WHATEKA2026 + WA2026 + … */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="inline-flex items-center gap-2">
              <Sparkles size={14} className="text-brand-cyan" /> Abonnements via code promo
            </span>
          </h2>
          <span className="text-xs text-slate-500">
            WHATEKA2026 (6 mois) · WA2026 (3 mois)
          </span>
        </div>
        {loading ? (
          <Loader />
        ) : promoRedemptions.length === 0 ? (
          <EmptyState
            title="Aucune redemption"
            description="Personne n'a encore utilisé un code promo Premium."
          />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Activé le</th>
                <th className="px-4 py-3">Expire le</th>
                <th className="px-4 py-3">Temps restant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promoRedemptions.map((r) => {
                const remaining = formatTimeRemaining(r.seconds_remaining);
                const remainingClass =
                  remaining.tone === 'expired'
                    ? 'bg-rose-100 text-rose-800'
                    : remaining.tone === 'warn'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800';
                return (
                  <tr key={`${r.user_id}-${r.code}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.email ?? <span className="text-slate-400">{r.user_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${promoCodeBadgeClass(r.code)}`}>{r.code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 capitalize">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles size={12} className="text-brand-cyan" />
                        {r.tier}
                        <span className="text-xs text-slate-400">· {r.duration_months} mois</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(r.redeemed_at)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.expires_at ? formatDateTime(r.expires_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${remainingClass}`}>{remaining.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
