import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item)).filter(Boolean)));
};

const sameIdArray = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((value, index) => value === bs[index]);
};

const normalizeSingleId = (value: unknown): string | null => {
  if (!value) return null;
  return String(value);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.app_role === 'Administrator';
    const isLoanOfficer = user.app_role === 'Loan Officer';
    if (!isAdmin && !isLoanOfficer) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const {
      loan_id,
      borrower_ids,
      loan_officer_ids,
      referrer_id,
      liaison_id,
      broker_id
    } = body || {};

    if (!loan_id) {
      return Response.json({ error: 'loan_id is required' }, { status: 400 });
    }

    const loan = await base44.asServiceRole.entities.Loan.get(loan_id);
    if (!loan) {
      return Response.json({ error: 'Loan not found' }, { status: 404 });
    }

    const nextBorrowerIds = normalizeIdArray(borrower_ids);
    const nextLoanOfficerIds = normalizeIdArray(loan_officer_ids);
    const nextReferrerId = normalizeSingleId(referrer_id);
    const nextLiaisonId = normalizeSingleId(liaison_id);
    const nextBrokerId = normalizeSingleId(broker_id);

    const fieldsChanged = ['borrower_ids', 'loan_officer_ids', 'referrer_id', 'liaison_id', 'broker_id'];
    const userName = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.full_name || user.email || 'Unknown User';
    const modificationHistory = Array.isArray(loan.modification_history)
      ? [...loan.modification_history]
      : [];

    modificationHistory.push({
      timestamp: new Date().toISOString(),
      modified_by: user.id,
      modified_by_name: userName,
      description: 'Loan team updated',
      fields_changed: fieldsChanged
    });

    await base44.asServiceRole.entities.Loan.update(loan_id, {
      borrower_ids: nextBorrowerIds,
      loan_officer_ids: nextLoanOfficerIds,
      referrer_id: nextReferrerId,
      liaison_id: nextLiaisonId,
      broker_id: nextBrokerId,
      overridden_fields: Array.from(
        new Set([...(Array.isArray(loan.overridden_fields) ? loan.overridden_fields : []), ...fieldsChanged])
      ),
      modification_history: modificationHistory
    });

    const updatedLoan = await base44.asServiceRole.entities.Loan.get(loan_id);
    const savedBorrowerIds = normalizeIdArray(updatedLoan?.borrower_ids);
    const savedLoanOfficerIds = normalizeIdArray(updatedLoan?.loan_officer_ids);
    const savedReferrerId = normalizeSingleId(updatedLoan?.referrer_id);
    const savedLiaisonId = normalizeSingleId(updatedLoan?.liaison_id);
    const savedBrokerId = normalizeSingleId(updatedLoan?.broker_id);

    const verified =
      sameIdArray(savedBorrowerIds, nextBorrowerIds) &&
      sameIdArray(savedLoanOfficerIds, nextLoanOfficerIds) &&
      savedReferrerId === nextReferrerId &&
      savedLiaisonId === nextLiaisonId &&
      savedBrokerId === nextBrokerId;

    if (!verified) {
      return Response.json(
        {
          error: 'Team update verification failed',
          requested: {
            borrower_ids: nextBorrowerIds,
            loan_officer_ids: nextLoanOfficerIds,
            referrer_id: nextReferrerId,
            liaison_id: nextLiaisonId,
            broker_id: nextBrokerId
          },
          saved: {
            borrower_ids: savedBorrowerIds,
            loan_officer_ids: savedLoanOfficerIds,
            referrer_id: savedReferrerId,
            liaison_id: savedLiaisonId,
            broker_id: savedBrokerId
          }
        },
        { status: 409 }
      );
    }

    return Response.json({
      success: true,
      loan_id,
      team: {
        borrower_ids: savedBorrowerIds,
        loan_officer_ids: savedLoanOfficerIds,
        referrer_id: savedReferrerId,
        liaison_id: savedLiaisonId,
        broker_id: savedBrokerId
      }
    });
  } catch (error) {
    console.error('Error updating loan team:', error);
    return Response.json({ error: error.message || 'Failed to update loan team' }, { status: 500 });
  }
});
