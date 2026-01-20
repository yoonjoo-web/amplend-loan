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

    const isAdmin = user.role === 'admin' || user.app_role === 'Administrator';
    const isLoanOfficer = user.app_role === 'Loan Officer';
    const isAssignedOfficer = loan.loan_officer_ids?.includes(user.id);
    const isBorrower = loan.borrower_ids?.includes(user.id);
    const isGuarantor = loan.guarantor_ids?.includes(user.id);
    const isReferrer = loan.referrer_ids?.includes(user.id);

    if (!(isAdmin || isLoanOfficer || isAssignedOfficer || isBorrower || isGuarantor || isReferrer)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const loanOfficerIds = Array.isArray(loan.loan_officer_ids) ? loan.loan_officer_ids : [];
    const loanOfficers = await Promise.all(
      loanOfficerIds.map(async (id) => {
        try {
          return await base44.asServiceRole.entities.User.get(id);
        } catch (error) {
          console.error('Error fetching loan officer:', error);
          return null;
        }
      })
    );

    return Response.json({
      loan_officer_ids: loanOfficerIds,
      loan_officers: loanOfficers.filter(Boolean)
    });
  } catch (error) {
    console.error('Error fetching loan officers for loan:', error);
    return Response.json({
      error: error.message || 'Failed to fetch loan officers'
    }, { status: 500 });
  }
});
