import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const normalizeAppRole = (value?: string) => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'administrator') return 'Administrator';
  if (normalized === 'loan officer') return 'Loan Officer';
  if (normalized === 'borrower') return 'Borrower';
  if (normalized === 'liaison') return 'Liaison';
  if (normalized === 'broker' || normalized === 'brokerage') return 'Broker';
  if (normalized === 'referrer' || normalized === 'referral partner') return 'Referral Partner';
  return String(value).trim();
};

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

    const normalizedRole = normalizeAppRole(user.app_role);
    const userId = String(user.id);
    const toIdArray = (singleValue: unknown, legacyList: unknown): string[] => {
      if (singleValue) return [String(singleValue)];
      if (Array.isArray(legacyList)) return legacyList.map(String).filter(Boolean);
      return [];
    };
    const matchesTeamIds = (values: string[], extraIds: string[] = []) => {
      if (!Array.isArray(values)) return false;
      if (values.includes(userId)) return true;
      return extraIds.some((id) => values.includes(String(id)));
    };

    const isAdmin = user.role === 'admin' || normalizedRole === 'Administrator';
    const isLoanOfficer = normalizedRole === 'Loan Officer';
    const loanOfficerIds = Array.isArray(loan.loan_officer_ids) ? loan.loan_officer_ids.map(String) : [];
    const isAssignedOfficer = loanOfficerIds.includes(userId);
    let borrowerContactId = null;
    try {
      const borrowersByUserId = await base44.asServiceRole.entities.Borrower.filter({ user_id: user.id });
      if (borrowersByUserId && borrowersByUserId.length > 0) {
        borrowerContactId = borrowersByUserId[0].id;
      } else if (user.email) {
        const borrowersByEmail = await base44.asServiceRole.entities.Borrower.filter({ email: user.email });
        if (borrowersByEmail && borrowersByEmail.length > 0) {
          borrowerContactId = borrowersByEmail[0].id;
        }
      }
    } catch (error) {
      console.error('Error resolving borrower contact id:', error);
    }

    let loanPartnerIds: string[] = [];
    try {
      const partnersByUserId = await base44.asServiceRole.entities.LoanPartner.filter({ user_id: user.id });
      if (partnersByUserId && partnersByUserId.length > 0) {
        loanPartnerIds = partnersByUserId.map((partner) => String(partner?.id)).filter(Boolean);
      } else if (user.email) {
        const partnersByEmail = await base44.asServiceRole.entities.LoanPartner.filter({ email: user.email });
        if (partnersByEmail && partnersByEmail.length > 0) {
          loanPartnerIds = partnersByEmail.map((partner) => String(partner?.id)).filter(Boolean);
        }
      }
    } catch (error) {
      console.error('Error resolving loan partner ids:', error);
    }

    const isBorrower = matchesTeamIds(
      Array.isArray(loan.borrower_ids) ? loan.borrower_ids.map(String) : [],
      borrowerContactId ? [String(borrowerContactId)] : []
    );
    const isGuarantor = matchesTeamIds(Array.isArray(loan.guarantor_ids) ? loan.guarantor_ids.map(String) : []);
    const isReferrer = matchesTeamIds(toIdArray(loan.referrer_id, loan.referrer_ids), loanPartnerIds);
    const isBroker = matchesTeamIds(toIdArray(loan.broker_id, loan.broker_ids), loanPartnerIds);
    const isLiaison = matchesTeamIds(
      toIdArray(loan.liaison_id, loan.liaison_ids),
      [...loanPartnerIds, ...(borrowerContactId ? [String(borrowerContactId)] : [])]
    );

    if (!(isAdmin || isLoanOfficer || isAssignedOfficer || isBorrower || isGuarantor || isReferrer || isBroker || isLiaison)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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
