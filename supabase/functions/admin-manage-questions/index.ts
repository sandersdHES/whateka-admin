import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await admin
      .from('admin_users')
      .select('role')
      .eq('email', user.email)
      .maybeSingle();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return json({ error: 'Forbidden: admin role required' }, 403);
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === 'create') {
      const q = body.question ?? {};
      const { data, error } = await admin
        .from('feedback_questions')
        .insert({
          questionnaire_type: q.questionnaire_type,
          text: q.text,
          answer_format: q.answer_format,
          choices: q.choices ?? null,
          is_required: q.is_required ?? true,
          is_active: q.is_active ?? true,
          order_index: q.order_index ?? 0,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ question: data });
    }

    if (action === 'update') {
      const q = body.question ?? {};
      if (!q.id) return json({ error: 'id required' }, 400);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of [
        'questionnaire_type',
        'text',
        'answer_format',
        'choices',
        'is_required',
        'is_active',
        'order_index',
      ]) {
        if (k in q) patch[k] = q[k];
      }
      const { data, error } = await admin
        .from('feedback_questions')
        .update(patch)
        .eq('id', q.id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ question: data });
    }

    if (action === 'delete') {
      const id = body.question?.id;
      if (!id) return json({ error: 'id required' }, 400);
      const { error } = await admin.from('feedback_questions').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'reorder') {
      const items = (body.items ?? []) as { id: string; order_index: number }[];
      for (const it of items) {
        const { error } = await admin
          .from('feedback_questions')
          .update({ order_index: it.order_index, updated_at: new Date().toISOString() })
          .eq('id', it.id);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
