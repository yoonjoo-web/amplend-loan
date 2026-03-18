import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Activate the borrower record
    if (borrower.is_invite_temp || !borrower.user_id) {
      await base44.asServiceRole.entities.Borrower.update(borrower.id, {
        is_invite_temp: false,
        invite_request_status: 'activated',
        user_id: userId
      });
      borrower = { ...borrower, user_id: userId, is_invite_temp: false };
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

    // Find applications where this borrower is referenced but not yet linked by user_id
    // Check as primary borrower (by borrower entity ID)
    try {
      const appsAsPrimary = await base44.asServiceRole.entities.LoanApplication.filter({ primary_borrower_id: borrower.id });
      for (const app of (appsAsPrimary || [])) {
        await base44.asServiceRole.entities.LoanApplication.update(app.id, {
          primary_borrower_id: userId
        });
      }
    } catch (err) {
      console.error('Error linking borrower as primary on applications:', err);
    }

    // Check as co-borrower (by borrower_id inside co_borrowers array)
    try {
      const allApps = await base44.asServiceRole.entities.LoanApplication.list();
      for (const app of (allApps || [])) {
        if (!app.co_borrowers || !Array.isArray(app.co_borrowers)) continue;
        let updated = false;
        const updatedCoBorrowers = app.co_borrowers.map(cb => {
          if (cb.borrower_id === borrower.id && (!cb.user_id || cb.user_id !== userId)) {
            updated = true;
            return { ...cb, user_id: userId };
          }
          return cb;
        });
        if (updated) {
          await base44.asServiceRole.entities.LoanApplication.update(app.id, {
            co_borrowers: updatedCoBorrowers
          });
        }
      }
    } catch (err) {
      console.error('Error linking borrower as co-borrower on applications:', err);
    }

    return Response.json({ status: 'activated', borrower_id: borrower.id });
  } catch (error) {
    console.error('Error activating borrower invite:', error);
    return Response.json({ error: error.message || 'Failed to activate borrower invite' }, { status: 500 });
  }
});