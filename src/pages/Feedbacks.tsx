import { useEffect, useMemo, useState } from 'react';
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
import { useToast } from '../components/Toast';

type SubmissionWithActivity = FeedbackSubmission & {
  activity: { id: number; title: string } | null;
  user_email: string | null;
};

export function Feedbacks() {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [answers, setAnswers] = useState<FeedbackAnswer[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [qRes, aRes, sRes] = await Promise.all([
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
            .order('submitted_at', { ascending: false })
            .limit(50),
        ]);
        if (qRes.error) throw qRes.error;
        if (aRes.error) throw aRes.error;
        if (sRes.error) throw sRes.error;
        setQuestions((qRes.data as FeedbackQuestion[]) ?? []);
        setAnswers((aRes.data as FeedbackAnswer[]) ?? []);
        setSubmissions(((sRes.data ?? []) as SubmissionWithActivity[]).map((s) => ({ ...s, user_email: null })));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur chargement.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

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
      }
    }
    return cards.slice(0, 4);
  }, [questions, answers]);

  const chartsData = useMemo(() => {
    return questions
      .filter((q) => q.answer_format === 'rating_5' || q.answer_format === 'yes_no')
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
        }
        return { question: q, data };
      })
      .filter((c) => c.data.some((d) => d.value > 0));
  }, [questions, answers]);

  const recentComments = useMemo(() => {
    return answers
      .filter(
        (a) => a.question_format_snapshot === 'text' && a.answer_text && a.answer_text.trim().length > 0,
      )
      .slice(0, 20);
  }, [answers]);

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
        <EmptyState title="Pas encore de feedback" description="Les statistiques apparaîtront dès que des réponses arriveront." />
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

      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Derniers feedbacks</h2>
        {submissions.length === 0 ? (
          <EmptyState title="Aucune soumission" />
        ) : (
          <div className="divide-y divide-slate-100">
            {submissions.slice(0, 10).map((s) => (
              <div key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">
                    {s.activity?.title ?? 'Questionnaire global'}
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(s.submitted_at)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {s.questionnaire_type === 'hot' ? 'À chaud' : 'À froid'} · {maskEmail(s.user_email)}
                </div>
              </div>
            ))}
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
    </div>
  );
}
