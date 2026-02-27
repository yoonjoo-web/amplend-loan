import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { loan_id } = body || {};

    if (!loan_id) {
      return Response.json({ error: 'loan_id is required' }, { status: 400 });
    }

    const loan = await base44.asServiceRole.entities.Loan.get(loan_id);
    if (!loan) {
      return Response.json({ error: 'Loan not found' }, { status: 404 });
    }

    const normalizeEntityId = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === 'string' || typeof value === 'number') return String(value);
      if (typeof value === 'object') {
        const record = value as { id?: string | number; user_id?: string | number; loan_officer_id?: string | number };
        if (record.id) return String(record.id);
        if (record.user_id) return String(record.user_id);
        if (record.loan_officer_id) return String(record.loan_officer_id);
      }
      return null;
    };

    const loanOfficerIds = Array.isArray(loan.loan_officer_ids)
      ? loan.loan_officer_ids.map(normalizeEntityId).filter(Boolean) as string[]
      : [];

    const resolveOfficerUserId = async (id: string): Promise<string | null> => {
      try {
        const user = await base44.asServiceRole.entities.User.get(id);
        if (user?.id) return String(user.id);
      } catch (_error) {
        // Fall through to queue lookup.
      }

      try {
        const queueRecord = await base44.asServiceRole.entities.LoanOfficerQueue.get(id);
        if (queueRecord?.loan_officer_id) return String(queueRecord.loan_officer_id);
      } catch (_error) {
        // Not a queue id either.
      }

      return null;
    };

    const resolvedOfficerUserIds = (
      await Promise.all(loanOfficerIds.map((id) => resolveOfficerUserId(id)))
    ).filter(Boolean) as string[];
    const uniqueResolvedOfficerUserIds = Array.from(new Set(resolvedOfficerUserIds));

    const loanOfficers = await Promise.all(
      uniqueResolvedOfficerUserIds.map(async (id) => {
        try {
          return await base44.asServiceRole.entities.User.get(id);
        } catch (error) {
          console.error('Error fetching loan officer:', error);
          return null;
        }
      })
    );

    return Response.json({
      loan_officer_ids: uniqueResolvedOfficerUserIds,
      loan_officers: loanOfficers.filter(Boolean)
    });
  } catch (error) {
    console.error('Error fetching loan officers for loan:', error);
    return Response.json({
      error: error.message || 'Failed to fetch loan officers'
    }, { status: 500 });
  }
});
