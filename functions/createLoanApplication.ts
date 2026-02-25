import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const pickLoanOfficerFromQueue = async (base44) => {
  const queue = await base44.asServiceRole.entities.LoanOfficerQueue.list('queue_position');
  if (!queue || queue.length === 0) return null;

  const [applications, loans] = await Promise.all([
    base44.asServiceRole.entities.LoanApplication.list(),
    base44.asServiceRole.entities.Loan.list()
  ]);

  const workloadCount = {};

  const activeApplications = applications.filter(app =>
    !['approved', 'rejected'].includes(app.status)
  );
  activeApplications.forEach(app => {
    if (app.assigned_loan_officer_id) {
      workloadCount[app.assigned_loan_officer_id] = (workloadCount[app.assigned_loan_officer_id] || 0) + 1;
    }
  });

  const activeLoans = loans.filter(loan =>
    !['archived', 'dead'].includes(loan.status)
  );
  activeLoans.forEach(loan => {
    if (loan.loan_officer_ids && loan.loan_officer_ids.length > 0) {
      loan.loan_officer_ids.forEach(officerId => {
        workloadCount[officerId] = (workloadCount[officerId] || 0) + 1;
      });
    }
  });

  let selectedOfficer = null;
  let minWorkload = Infinity;

  for (const queueItem of queue) {
    const officerId = queueItem.loan_officer_id;
    const workload = workloadCount[officerId] || 0;

    if (workload < minWorkload) {
      minWorkload = workload;
      selectedOfficer = officerId;
    }
  }

  return selectedOfficer;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const applicationData = body?.application_data;

    if (!applicationData) {
      return Response.json({ error: 'Application data is required' }, { status: 400 });
    }

    const role = user.app_role || '';
    const isAdmin = user.role === 'admin' || role === 'Administrator';
    const isLoanOfficer = role === 'Loan Officer';
    const isBorrower = role === 'Borrower' || role === 'Liaison';
    const isBroker = role === 'Broker';

    if (!(isAdmin || isLoanOfficer || isBorrower || isBroker)) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let assignedOfficerId = applicationData.assigned_loan_officer_id || null;
    if (!assignedOfficerId) {
      if (isLoanOfficer) {
        assignedOfficerId = user.id;
      } else {
        assignedOfficerId = await pickLoanOfficerFromQueue(base44);
      }
    }

    const createData = {
      ...applicationData,
      assigned_loan_officer_id: assignedOfficerId || null
    };

    // For brokers, ensure broker_user_id is set so they can retrieve their own applications
    if (isBroker && !createData.broker_user_id) {
      createData.broker_user_id = user.id;
    }

    const newApplication = await base44.asServiceRole.entities.LoanApplication.create(createData);

    return Response.json({ application: newApplication });
  } catch (error) {
    console.error('Error creating application:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});