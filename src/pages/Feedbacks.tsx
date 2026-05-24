import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import type { FeedbackAnswer, FeedbackQuestion, FeedbackSubmission } from '../lib/types';
import { formatDateTime, maskEmail } from '../lib/format';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

type SubmissionWithActivity = FeedbackSubmission & {
  activity: { id: number; title: string } | null;
  user_email: string | null;
};

/**
 * Page Feedbacks : agrege les reponses, affiche les KPIs en haut, les
 * graphiques par question (rating / yes-no / multi-choice), la liste
 * complete des soumissions avec modal de detail, et les commentaires texte.
 */
export function Feedbacks() {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [answers, setAnswers] = useState<FeedbackAnswer[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Tout charge en parallele : questions actives, toutes les reponses,
        // toutes les soumissions, et la liste d'utilisateurs pour joindre les
        // emails (auth.users n'est pas accessible directement -> edge function).
        const [qRes, aRes, sRes, uRes] = await Promise.all([
          supabase
            .from('feedback_questions')
            .select('*')
            .eq('is_active', true)
            .order('questionnaire_type')
            .order('order_index'),
          supabase.from('feedback_answers').select('*'),
          supabase
            .from('feedback_submissions')
            .select('*, activity:activities(id,title)')
            .order('submitted_at', { ascending: false }),
          supabase.functions.invoke<{ users: { id: string; email: string }[] }>(
            'admin-list-users',
          ),
        ]);
        if (qRes.error) throw qRes.error;
        if (aRes.error) throw aRes.error;
        if (sRes.error) throw sRes.error;
        // L'edge admin-list-users peut echouer si non super_admin : on accepte
        // silencieusement et on affiche les emails masques.
        const userMap = new Map<string, string>();
        if (!uRes.error && uRes.data?.users) {
          for (const u of uRes.data.users) userMap.set(u.id, u.email);
        }

        setQuestions((qRes.data as FeedbackQuestion[]) ?? []);
        setAnswers((aRes.data as FeedbackAnswer[]) ?? []);
        setSubmissions(
          ((sRes.data ?? []) as SubmissionWithActivity[]).map((s) => ({
            ...s,
            user_email: s.user_id ? userMap.get(s.user_id) ?? null : null,
          })),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur chargement.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  // KPIs sommaires : moyenne (rating), % oui (yes/no), repartition (multi_choice)
  const summaryStats = useMemo(() => {
    const cards: { label: string; value: string }[] = [];
    for (const q of questions) {
      const qAnswers = answers.filter((a) => a.question_id === q.id);
      if (qAnswers.length === 0) continue;
      if (q.answer_format === 'rating_5') {
        const vals = qAnswers.map((a) => a.answer_rating ?? 0).filter((v) => v > 0);
        if (vals.length === 0) continue;
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        cards.push({ label: q.text, value: `${avg.toFixed(1)} / 5` });
      } else if (q.answer_format === 'yes_no') {
        const vals = qAnswers.map((a) => a.answer_bool).filter((v): v is boolean => v !== null);
        if (vals.length === 0) continue;
        const pct = (vals.filter(Boolean).length / vals.length) * 100;
        cards.push({ label: q.text, value: `${pct.toFixed(0)} % Oui` });
      } else if (q.answer_format === 'multi_choice') {
        // KPI = choix le plus frequent (modal answer) + son %
        const counts = new Map<string, number>();
        for (const a of qAnswers) {
          if (a.answer_choice) {
            counts.set(a.answer_choice, (counts.get(a.answer_choice) ?? 0) + 1);
          }
        }
        if (counts.size === 0) continue;
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const [topChoice, topCount] = sorted[0];
        const total = qAnswers.length;
        const pct = ((topCount / total) * 100).toFixed(0);
        cards.push({ label: q.text, value: `${topChoice.trim()} (${pct}%)` });
      }
    }
    return cards.slice(0, 6);
  }, [questions, answers]);

  // Graphes : rating_5, yes_no, multi_choice
  const chartsData = useMemo(() => {
    return questions
      .filter(
        (q) =>
          q.answer_format === 'rating_5' ||
          q.answer_format === 'yes_no' ||
          q.answer_format === 'multi_choice',
      )
      .map((q) => {
        const qAnswers = answers.filter((a) => a.question_id === q.id);
        let data: { name: string; value: number }[] = [];
        if (q.answer_format === 'rating_5') {
          data = [1, 2, 3, 4, 5].map((n) => ({
            name: `${n} ★`,
            value: qAnswers.filter((a) => a.answer_rating === n).length,
          }));
        } else if (q.answer_format === 'yes_no') {
          data = [
            { name: 'Oui', value: qAnswers.filter((a) => a.answer_bool === true).length },
            { name: 'Non', value: qAnswers.filter((a) => a.answer_bool === false).length },
          ];
        } else if (q.answer_format === 'multi_choice') {
          // Conserver l'ordre original des choix (DB) pour la lisibilite
          const choices = (q.choices ?? []) as string[];
          data = choices.map((choice) => ({
            name: choice.trim(),
            value: qAnswers.filter(
              (a) => (a.answer_choice ?? '').trim() === choice.trim(),
            ).length,
          }));
        }
        return { question: q, data };
      })
      .filter((c) => c.data.some((d) => d.value > 0));
  }, [questions, answers]);

  // Commentaires texte (questions free-text)
  const recentComments = useMemo(() => {
    return answers
      .filter(
        (a) =>
          a.question_format_snapshot === 'text' &&
          a.answer_text &&
          a.answer_text.trim().length > 0,
      )
      .slice(0, 20);
  }, [answers]);

  // Modal : reponses du feedback selectionne
  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.id === selectedSubmissionId) ?? null,
    [submissions, selectedSubmissionId],
  );
  const selectedAnswers = useMemo(() => {
    if (!selectedSubmissionId) return [];
    return answers
      .filter((a) => a.submission_id === selectedSubmissionId)
      .sort((a, b) => {
        // Trier par order_index de la question si possible
        const qa = questions.find((q) => q.id === a.question_id);
        const qb = questions.find((q) => q.id === b.question_id);
        return (qa?.order_index ?? 999) - (qb?.order_index ?? 999);
      });
  }, [answers, questions, selectedSubmissionId]);

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Feedbacks</h1>
        <p className="text-sm text-slate-500">
          Réponses aux questionnaires à chaud et à froid.
        </p>
      </div>

      {summaryStats.length === 0 ? (
        <EmptyState
          title="Pas encore de feedback"
          description="Les statistiques apparaîtront dès que des réponses arriveront."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryStats.map((s) => (
            <div key={s.label} className="card">
              <div className="mb-1 text-xs text-slate-500 line-clamp-2">{s.label}</div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {chartsData.map(({ question, data }) => (
          <div key={question.id} className="card">
            <h3 className="mb-1 text-sm font-semibold text-slate-900">{question.text}</h3>
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
              {question.questionnaire_type === 'hot' ? 'À chaud' : 'À froid'}
              {question.answer_format === 'multi_choice' && ' · Choix multiple'}
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#00B8D9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Liste de TOUS les feedbacks (anciennement limitee a 10).
          Click sur "Voir" -> modal avec toutes les reponses + user email. */}
      <div className="card">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">Derniers feedbacks</h2>
          <span className="text-xs text-slate-500">
            {submissions.length} feedback{submissions.length > 1 ? 's' : ''}
          </span>
        </div>
        {submissions.length === 0 ? (
          <EmptyState title="Aucune soumission" />
        ) : (
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Activité</th>
                  <th className="px-2 py-2 font-medium">Utilisateur</th>
                  <th className="px-2 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-2 py-3 text-slate-700 whitespace-nowrap">
                      {formatDateTime(s.submitted_at)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.questionnaire_type === 'hot'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {s.questionnaire_type === 'hot' ? 'À chaud' : 'À froid'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-700">
                      {s.activity?.title ?? (
                        <span className="italic text-slate-400">Global (sans activité)</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-700">
                      {s.user_email ?? (s.user_id ? maskEmail(null) : <span className="italic text-slate-400">Anonyme</span>)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSubmissionId(s.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye size={14} /> Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recentComments.length > 0 && (
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Commentaires texte</h2>
          <div className="space-y-3">
            {recentComments.map((c) => (
              <blockquote
                key={c.id}
                className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100"
              >
                <div className="mb-1 text-xs text-slate-400">{c.question_text_snapshot}</div>
                « {c.answer_text} »
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* Modal : feedback complet (toutes les reponses + meta) */}
      <Modal
        open={!!selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
        title="Feedback complet"
        maxWidth="max-w-3xl"
      >
        {selectedSubmission && (
          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Date</div>
                <div className="font-medium text-slate-900">
                  {formatDateTime(selectedSubmission.submitted_at)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Type</div>
                <div className="font-medium text-slate-900">
                  {selectedSubmission.questionnaire_type === 'hot' ? 'À chaud' : 'À froid'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Activité</div>
                <div className="font-medium text-slate-900">
                  {selectedSubmission.activity?.title ?? (
                    <span className="italic text-slate-400">Global (sans activité)</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Utilisateur</div>
                <div className="font-medium text-slate-900">
                  {selectedSubmission.user_email ??
                    (selectedSubmission.user_id ? (
                      <span className="text-slate-500">
                        ID : <code className="text-xs">{selectedSubmission.user_id}</code>
                      </span>
                    ) : (
                      <span className="italic text-slate-400">Anonyme</span>
                    ))}
                </div>
              </div>
              {selectedSubmission.searches_count != null && (
                <div>
                  <div className="text-xs text-slate-500">Nb recherches</div>
                  <div className="font-medium text-slate-900">
                    {selectedSubmission.searches_count}
                  </div>
                </div>
              )}
            </div>

            {/* Reponses */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Réponses ({selectedAnswers.length})
              </h3>
              {selectedAnswers.length === 0 ? (
                <p className="text-sm italic text-slate-500">Aucune réponse enregistrée.</p>
              ) : (
                <div className="space-y-3">
                  {selectedAnswers.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="mb-1 text-xs font-medium text-slate-500">
                        {a.question_text_snapshot}
                      </div>
                      <div className="text-sm text-slate-900">
                        {renderAnswerValue(a)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Formate une reponse selon le format snapshot pour affichage dans la modal. */
function renderAnswerValue(a: FeedbackAnswer): ReactNode {
  switch (a.question_format_snapshot) {
    case 'rating_5':
      return (
        <span>
          {'★'.repeat(a.answer_rating ?? 0)}
          {'☆'.repeat(5 - (a.answer_rating ?? 0))}
          <span className="ml-2 text-xs text-slate-500">({a.answer_rating ?? 0}/5)</span>
        </span>
      );
    case 'yes_no':
      return a.answer_bool === true ? (
        <span className="font-medium text-emerald-600">Oui</span>
      ) : a.answer_bool === false ? (
        <span className="font-medium text-rose-600">Non</span>
      ) : (
        <span className="italic text-slate-400">—</span>
      );
    case 'multi_choice':
      return (
        <span className="font-medium text-slate-900">
          {(a.answer_choice ?? '').trim() || <span className="italic text-slate-400">—</span>}
        </span>
      );
    case 'text':
      return a.answer_text ? (
        <span className="italic">« {a.answer_text} »</span>
      ) : (
        <span className="italic text-slate-400">—</span>
      );
    default:
      return <span className="italic text-slate-400">Format inconnu</span>;
  }
}
