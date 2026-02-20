import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email;
    const userId = user.id;
    if (!email && !userId) {
      return Response.json({ error: 'Missing user identifiers' }, { status: 400 });
    }

    let borrower = null;
    if (userId) {
      const byUserId = await base44.asServiceRole.entities.Borrower.filter({ user_id: userId });
      borrower = byUserId?.find(b => b.is_invite_temp) || byUserId?.[0] || null;
    }
    if (!borrower && email) {
      const byEmail = await base44.asServiceRole.entities.Borrower.filter({ email });
      borrower = byEmail?.find(b => b.is_invite_temp) || byEmail?.[0] || null;
    }

    if (!borrower) {
      return Response.json({ status: 'no_borrower' });
    }

    if (borrower.is_invite_temp) {
      await base44.asServiceRole.entities.Borrower.update(borrower.id, {
        is_invite_temp: false,
        invite_request_status: 'activated',
        user_id: borrower.user_id || userId
      });
    }

    if (borrower.invite_request_id) {
      try {
        await base44.asServiceRole.entities.BorrowerInviteRequest.update(borrower.invite_request_id, {
          status: 'activated',
          activated_by_user_id: userId,
          activated_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating invite request status:', error);
      }
    }

    return Response.json({ status: 'activated', borrower_id: borrower.id });
  } catch (error) {
    console.error('Error activating borrower invite:', error);
    return Response.json({ error: error.message || 'Failed to activate borrower invite' }, { status: 500 });
  }
});
