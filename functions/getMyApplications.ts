import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const resolveBorrowerAccessIds = async (base44, user) => {
  if (!user) return [];
  let borrowerId = null;
  try {
    const byUserId = await base44.asServiceRole.entities.Borrower.filter({ user_id: user.id });
    if (byUserId && byUserId.length > 0) {
      borrowerId = byUserId[0].id;
    } else if (user.email) {
      const byEmail = await base44.asServiceRole.entities.Borrower.filter({ email: user.email });
      if (byEmail && byEmail.length > 0) {
        borrowerId = byEmail[0].id;
      }
    }
  } catch (error) {
    console.error('Error resolving borrower access ids:', error);
  }
  return Array.from(new Set([user.id, borrowerId].filter(Boolean)));
};

const resolveLoanPartnerAccessIds = async (base44, user) => {
  if (!user) return [];
  let partnerIds = [];
  try {
    const byUserId = await base44.asServiceRole.entities.LoanPartner.filter({ user_id: user.id });
    if (byUserId && byUserId.length > 0) {
      partnerIds = byUserId.map((partner) => partner.id).filter(Boolean);
    } else if (user.email) {
      const byEmail = await base44.asServiceRole.entities.LoanPartner.filter({ email: user.email });
      if (byEmail && byEmail.length > 0) {
        partnerIds = byEmail.map((partner) => partner.id).filter(Boolean);
      }
    }
  } catch (error) {
    console.error('Error resolving loan partner access ids:', error);
  }
  return Array.from(new Set(partnerIds.filter(Boolean)));
};

const matchesContact = (contact, user, partnerIds) => {
  if (!contact || typeof contact !== 'object') return false;
  if (contact.user_id && contact.user_id === user.id) return true;
  if (contact.id && (contact.id === user.id || partnerIds.includes(contact.id))) return true;
  if (contact.email && user.email) {
    return String(contact.email).toLowerCase() === String(user.email).toLowerCase();
  }
  return false;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [borrowerAccessIds, loanPartnerAccessIds] = await Promise.all([
      resolveBorrowerAccessIds(base44, user),
      resolveLoanPartnerAccessIds(base44, user)
    ]);

    const applications = await base44.asServiceRole.entities.LoanApplication.list('-created_date');

    const userId = user.id;
    const filtered = (applications || []).filter((app) => {
      if (!app) return false;
      const createdById = typeof app.created_by === 'object' ? app.created_by?.id : app.created_by;
      const isCreator = Boolean(createdById && createdById === userId);
      const isPrimaryBorrower = Boolean(borrowerAccessIds.includes(app.primary_borrower_id));
      const isCoBorrower = Boolean(
        Array.isArray(app.co_borrowers) && app.co_borrowers.some((cb) =>
          borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
        )
      );
      if (isCreator || isPrimaryBorrower || isCoBorrower) return true;

      const matchesIdList = (ids) => {
        if (!Array.isArray(ids)) return false;
        if (ids.includes(userId)) return true;
        return loanPartnerAccessIds.some((partnerId) => ids.includes(partnerId));
      };

      const matchesReferrerIds = matchesIdList(app.referrer_ids);
      const matchesLiaisonIds = matchesIdList(app.liaison_ids);
      const matchesBrokerIds = matchesIdList(app.broker_ids);
      if (matchesReferrerIds || matchesLiaisonIds || matchesBrokerIds) return true;

      const matchesReferralBroker = matchesContact(app.referral_broker, user, loanPartnerAccessIds);
      const matchesLoanBroker = matchesContact(app.loan_contacts?.broker, user, loanPartnerAccessIds);
      if (matchesReferralBroker || matchesLoanBroker) return true;

      // Also check broker_user_id field (set when broker creates application)
      if (app.broker_user_id && app.broker_user_id === userId) return true;

      return false;
    });

    try {
      const sampleApps = (applications || []).slice(0, 5).map((app) => ({
        id: app?.id,
        application_number: app?.application_number,
        created_by: app?.created_by,
        primary_borrower_id: app?.primary_borrower_id,
        co_borrowers: app?.co_borrowers,
        broker_ids: app?.broker_ids,
        referrer_ids: app?.referrer_ids,
        liaison_ids: app?.liaison_ids,
        referral_broker: app?.referral_broker,
        loan_contacts: app?.loan_contacts
      }));
      console.log('[getMyApplications] user:', {
        id: userId,
        email: user.email,
        borrowerAccessIds,
        loanPartnerAccessIds
      });
      console.log('[getMyApplications] total apps:', applications?.length || 0);
      console.log('[getMyApplications] filtered apps:', filtered.length);
      console.log('[getMyApplications] sample apps:', sampleApps);
    } catch (logError) {
      console.error('[getMyApplications] log error:', logError);
    }

    return Response.json({ applications: filtered });
  } catch (error) {
    console.error('Error fetching my applications:', error);
    return Response.json({
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});