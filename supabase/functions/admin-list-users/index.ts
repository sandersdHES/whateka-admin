import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    if (profile?.role !== 'super_admin') {
      return json({ error: 'Forbidden: super_admin role required' }, 403);
    }

    const all: Array<{
      id: string;
      email: string | null;
      first_name: string | null;
      created_at: string;
      last_sign_in_at: string | null;
    }> = [];

    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return json({ error: error.message }, 500);
      const users = data.users ?? [];
      for (const u of users) {
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        all.push({
          id: u.id,
          email: u.email ?? null,
          first_name:
            (typeof meta.first_name === 'string' && meta.first_name) ||
            (typeof meta.firstName === 'string' && meta.firstName) ||
            (typeof meta.name === 'string' && (meta.name as string).split(' ')[0]) ||
            null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 20) break;
    }

    const { data: subsData } = await admin.from('feedback_submissions').select('user_id');
    const submissionCounts = new Map<string, number>();
    for (const row of subsData ?? []) {
      const uid = (row as { user_id: string | null }).user_id;
      if (uid) submissionCounts.set(uid, (submissionCounts.get(uid) ?? 0) + 1);
    }

    const users = all.map((u) => ({
      ...u,
      login_count: u.last_sign_in_at ? 1 : 0,
      questionnaires_count: submissionCounts.get(u.id) ?? 0,
    }));

    return json({ users });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
