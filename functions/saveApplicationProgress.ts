import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { isUserOnApplicationTeam } from './utils/teamAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { application_id, data } = body;

    if (!application_id || !data) {
      return Response.json({ error: 'application_id and data are required' }, { status: 400 });
    }

    // Fetch the application to verify access and get the preserved fields
    const application = await base44.asServiceRole.entities.LoanApplication.get(application_id);
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Verify user has access
    const isAdmin = user.role === 'admin' || user.app_role === 'Administrator';
    const isLoanOfficer = user.app_role === 'Loan Officer';
    const isAssignedOfficer = application.assigned_loan_officer_id === user.id;

    let borrowerContactId = null;
    try {
      const byUserId = await base44.asServiceRole.entities.Borrower.filter({ user_id: user.id });
      if (byUserId && byUserId.length > 0) {
        borrowerContactId = byUserId[0].id;
      } else if (user.email) {
        const byEmail = await base44.asServiceRole.entities.Borrower.filter({ email: user.email });
        if (byEmail && byEmail.length > 0) borrowerContactId = byEmail[0].id;
      }
    } catch (_e) { /* ignore */ }

    let loanPartnerIds = [];
    try {
      const byUserId = await base44.asServiceRole.entities.LoanPartner.filter({ user_id: user.id });
      if (byUserId && byUserId.length > 0) {
        loanPartnerIds = byUserId.map(p => p.id).filter(Boolean);
      } else if (user.email) {
        const byEmail = await base44.asServiceRole.entities.LoanPartner.filter({ email: user.email });
        if (byEmail && byEmail.length > 0) loanPartnerIds = byEmail.map(p => p.id).filter(Boolean);
      }
    } catch (_e) { /* ignore */ }

    const isPrimaryBorrower = application.primary_borrower_id === user.id || application.primary_borrower_id === borrowerContactId;
    const createdById = typeof application.created_by === 'object' ? application.created_by?.id : application.created_by;
    const isCreator = createdById === user.id;

    let isCoBorrower = false;
    if (Array.isArray(application.co_borrowers)) {
      isCoBorrower = application.co_borrowers.some(cb =>
        cb.user_id === user.id || cb.borrower_id === borrowerContactId
      );
    }

    const hasAccess =
      isAdmin ||
      isLoanOfficer ||
      isAssignedOfficer ||
      isPrimaryBorrower ||
      isCoBorrower ||
      isCreator ||
      isUserOnApplicationTeam(application, { id: user.id, email: user.email, partnerIds: loanPartnerIds });

    if (!hasAccess) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Always restore broker/team identity fields from the stored application to prevent them being wiped
    const safeData = {
      ...data,
    };
    if (application.broker_user_id) safeData.broker_user_id = application.broker_user_id;
    if (application.broker_ids && application.broker_ids.length > 0) safeData.broker_ids = application.broker_ids;
    if (application.referrer_ids && application.referrer_ids.length > 0) safeData.referrer_ids = application.referrer_ids;
    if (application.liaison_ids && application.liaison_ids.length > 0) safeData.liaison_ids = application.liaison_ids;
    if (application.referral_broker) safeData.referral_broker = application.referral_broker;
    if (application.loan_contacts && Object.keys(application.loan_contacts).length > 0) safeData.loan_contacts = application.loan_contacts;

    await base44.asServiceRole.entities.LoanApplication.update(application_id, safeData);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error saving application progress:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});