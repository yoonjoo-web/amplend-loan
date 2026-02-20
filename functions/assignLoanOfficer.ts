import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';


Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all queue items sorted by position
        const queue = await base44.asServiceRole.entities.LoanOfficerQueue.list('queue_position');
        
        if (queue.length === 0) {
            return Response.json({ 
                error: 'No loan officers in queue',
                loan_officer_id: null 
            }, { status: 400 });
        }

        // Get all applications and loans (filter after fetch)
        const [applications, loans] = await Promise.all([
            base44.asServiceRole.entities.LoanApplication.list(),
            base44.asServiceRole.entities.Loan.list()
        ]);

        // Count workload per officer (applications + loans)
        const workloadCount = {};
        
        // Count applications
        const activeApplications = applications.filter(app =>
            !['approved', 'rejected'].includes(app.status)
        );
        activeApplications.forEach(app => {
            if (app.assigned_loan_officer_id) {
                workloadCount[app.assigned_loan_officer_id] = (workloadCount[app.assigned_loan_officer_id] || 0) + 1;
            }
        });

        // Count loans
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

        // Find the officer with lowest workload, prioritizing queue position
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

        return Response.json({ 
            loan_officer_id: selectedOfficer,
            current_workload: minWorkload
        });

    } catch (error) {
        console.error('Error assigning loan officer:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
