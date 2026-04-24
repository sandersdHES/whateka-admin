import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { FeedbackQuestion } from '../lib/types';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

type Editing = Partial<FeedbackQuestion> & { isNew?: boolean };

async function invokeAdmin<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-manage-questions', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  return data as T;
}

export function Questionnaires() {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feedback_questions')
      .select('*')
      .order('questionnaire_type')
      .order('order_index');
    if (error) toast.error(error.message);
    setQuestions((data as FeedbackQuestion[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(q: Editing) {
    try {
      if (q.isNew) {
        await invokeAdmin('create', {
          question: {
            questionnaire_type: q.questionnaire_type ?? 'hot',
            text: q.text ?? '',
            answer_format: q.answer_format ?? 'rating_5',
            choices: q.choices ?? null,
            is_required: q.is_required ?? true,
            is_active: q.is_active ?? true,
            order_index: q.order_index ?? questions.length + 1,
          },
        });
        toast.success('Question créée.');
      } else {
        await invokeAdmin('update', { question: q });
        toast.success('Question mise à jour.');
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    }
  }

  async function remove(q: FeedbackQuestion) {
    if (!confirm(`Supprimer « ${q.text} » ?`)) return;
    try {
      await invokeAdmin('delete', { question: { id: q.id } });
      toast.success('Supprimée.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    }
  }

  async function toggleActive(q: FeedbackQuestion) {
    try {
      await invokeAdmin('update', { question: { id: q.id, is_active: !q.is_active } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    }
  }

  async function move(q: FeedbackQuestion, direction: -1 | 1) {
    const siblings = questions
      .filter((x) => x.questionnaire_type === q.questionnaire_type)
      .sort((a, b) => a.order_index - b.order_index);
    const idx = siblings.findIndex((x) => x.id === q.id);
    const swap = siblings[idx + direction];
    if (!swap) return;
    try {
      await invokeAdmin('reorder', {
        items: [
          { id: q.id, order_index: swap.order_index },
          { id: swap.id, order_index: q.order_index },
        ],
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Questionnaires</h1>
          <p className="text-sm text-slate-500">Gérer les questions des feedbacks utilisateurs.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ isNew: true, questionnaire_type: 'hot', answer_format: 'rating_5', is_active: true, is_required: true })}>
          <Plus size={16} />
          Nouvelle question
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : questions.length === 0 ? (
        <EmptyState title="Aucune question" />
      ) : (
        (['hot', 'cold'] as const).map((type) => {
          const list = questions.filter((q) => q.questionnaire_type === type);
          if (list.length === 0) return null;
          return (
            <div key={type} className="card">
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Questionnaire {type === 'hot' ? 'à chaud' : 'à froid'}
              </h2>
              <div className="divide-y divide-slate-100">
                {list.map((q) => (
                  <div key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm font-medium text-slate-900">
                        {q.order_index}. {q.text}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="badge bg-slate-100 text-slate-700">{q.answer_format}</span>
                        {q.is_required && <span className="badge bg-slate-100 text-slate-700">requise</span>}
                        {!q.is_active && <span className="badge bg-rose-100 text-rose-700">inactive</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => move(q, -1)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Monter">
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => move(q, 1)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Descendre">
                        <ArrowDown size={16} />
                      </button>
                      <button onClick={() => toggleActive(q)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title={q.is_active ? 'Désactiver' : 'Activer'}>
                        {q.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => setEditing(q)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Éditer">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(q)} className="rounded-md p-2 text-rose-500 hover:bg-rose-50" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'Nouvelle question' : 'Éditer la question'}
      >
        {editing && (
          <QuestionEditor
            value={editing}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        )}
      </Modal>
    </div>
  );
}

function QuestionEditor({
  value,
  onCancel,
  onSubmit,
}: {
  value: Editing;
  onCancel: () => void;
  onSubmit: (v: Editing) => Promise<void>;
}) {
  const [v, setV] = useState<Editing>(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const choices = Array.isArray(v.choices) ? v.choices : [];

  async function handle() {
    if (!(v.text ?? '').trim()) return setErr('Le texte est requis.');
    if (v.answer_format === 'multi_choice' && choices.length < 2)
      return setErr('Au moins 2 options pour un choix multiple.');
    setBusy(true);
    try {
      await onSubmit(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
          {err}
        </div>
      )}
      <div>
        <label className="label">Type de questionnaire</label>
        <select
          className="input"
          value={v.questionnaire_type ?? 'hot'}
          onChange={(e) => setV({ ...v, questionnaire_type: e.target.value as 'hot' | 'cold' })}
        >
          <option value="hot">À chaud</option>
          <option value="cold">À froid</option>
        </select>
      </div>
      <div>
        <label className="label">Texte de la question</label>
        <textarea
          className="input min-h-[80px]"
          value={v.text ?? ''}
          onChange={(e) => setV({ ...v, text: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Format de réponse</label>
        <select
          className="input"
          value={v.answer_format ?? 'rating_5'}
          onChange={(e) => setV({ ...v, answer_format: e.target.value as FeedbackQuestion['answer_format'] })}
        >
          <option value="rating_5">Note 1 à 5</option>
          <option value="yes_no">Oui / Non</option>
          <option value="text">Texte libre</option>
          <option value="multi_choice">Choix multiple</option>
        </select>
      </div>
      {v.answer_format === 'multi_choice' && (
        <div>
          <label className="label">Options (min 2)</label>
          <div className="space-y-2">
            {choices.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setV({ ...v, choices: next });
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setV({ ...v, choices: choices.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setV({ ...v, choices: [...choices, ''] })}
            >
              + Ajouter une option
            </button>
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={v.is_required ?? true}
          onChange={(e) => setV({ ...v, is_required: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
        />
        Question obligatoire
      </label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button className="btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button className="btn-primary" onClick={handle} disabled={busy}>
          {busy ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
