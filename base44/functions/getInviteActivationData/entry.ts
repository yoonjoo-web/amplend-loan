import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(user.app_role || user.role || '').toLowerCase();
    const isAllowed =
      role === 'loan officer' ||
      role === 'administrator' ||
      role === 'platform admin' ||
      role === 'admin';

    if (!isAllowed) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [users, borrowers, inviteTokens] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Borrower.list(),
      base44.asServiceRole.entities.BorrowerInviteToken.list()
    ]);

    return Response.json({
      users: (users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        app_role: u.app_role,
        role: u.role
      })),
      borrowers: (borrowers || []).map((b: any) => ({
        id: b.id,
        email: b.email,
        user_id: b.user_id,
        is_invite_temp: b.is_invite_temp,
        invite_token_id: b.invite_token_id,
        invited_by_user_id: b.invited_by_user_id,
        invited_by_role: b.invited_by_role,
        first_name: b.first_name,
        last_name: b.last_name,
        updated_date: b.updated_date,
        created_date: b.created_date,
        invite_request_status: b.invite_request_status,
        invite_sent_at: b.invite_sent_at
      })),
      inviteTokens: (inviteTokens || []).map((t: any) => ({
        id: t.id,
        request_id: t.request_id,
        status: t.status,
        used_at: t.used_at
      }))
    });
  } catch (error) {
    console.error('Error fetching invite activation data:', error);
    return Response.json(
      { error: (error as Error)?.message || 'Failed to fetch invite activation data' },
      { status: 500 }
    );
  }
});
