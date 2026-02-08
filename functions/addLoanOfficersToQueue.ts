import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';


Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.app_role !== 'Administrator')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all users with Loan Officer role
    const allUsers = await base44.asServiceRole.entities.User.list();
    const loanOfficers = allUsers.filter(u => u.app_role === 'Loan Officer');

    // Get existing queue entries
    const existingQueues = await base44.entities.LoanOfficerQueue.list();
    const existingOfficerIds = new Set(existingQueues.map(q => q.loan_officer_id));

    // Find loan officers not in queue
    const missingOfficers = loanOfficers.filter(lo => !existingOfficerIds.has(lo.id));

    if (missingOfficers.length === 0) {
      return Response.json({ 
        message: 'All loan officers are already in the queue',
        added: 0 
      });
    }

    // Get current max position
    const maxPosition = existingQueues.length > 0 
      ? Math.max(...existingQueues.map(q => q.queue_position || 0)) 
      : 0;

    // Add missing officers to queue
    const addedOfficers = [];
    for (let i = 0; i < missingOfficers.length; i++) {
      const officer = missingOfficers[i];
      const queueEntry = await base44.entities.LoanOfficerQueue.create({
        loan_officer_id: officer.id,
        queue_position: maxPosition + i + 1,
        active_loan_count: 0,
        is_active: true
      });
      addedOfficers.push({
        id: officer.id,
        name: officer.first_name && officer.last_name 
          ? `${officer.first_name} ${officer.last_name}`
          : officer.email,
        position: maxPosition + i + 1
      });
    }

    return Response.json({ 
      message: `Added ${addedOfficers.length} loan officers to queue`,
      added: addedOfficers.length,
      officers: addedOfficers
    });

  } catch (error) {
    console.error('Error adding loan officers to queue:', error);
    return Response.json({ 
      error: error.message || 'Failed to add loan officers to queue' 
    }, { status: 500 });
  }
});