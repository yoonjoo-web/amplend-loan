import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { syncEntities } from './entitySyncHelper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin, Administrator, or Loan Officer can propagate changes
    if (user.role !== 'admin' && user.app_role !== 'Administrator' && user.app_role !== 'Loan Officer') {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { 
      profile_type,  // 'borrower', 'entity', 'partner'
      profile_id,
      profile_data,
      application_ids = [],
      loan_ids = []
    } = await req.json();

    if (!profile_type || !profile_id || !profile_data) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updates = {
      applications: [],
      loans: []
    };

    // Update applications
    for (const appId of application_ids) {
      try {
        const app = await base44.asServiceRole.entities.LoanApplication.get(appId);
        if (!app) continue;

        let mappedData = {};
        
        if (profile_type === 'borrower') {
          // Get full borrower data
          const borrower = await base44.asServiceRole.entities.Borrower.get(profile_id);
          mappedData = syncEntities('Borrower', 'LoanApplication', borrower);
        } else if (profile_type === 'entity') {
          // Get full entity data
          const entity = await base44.asServiceRole.entities.BorrowerEntity.get(profile_id);
          mappedData = syncEntities('BorrowerEntity', 'LoanApplication', entity);
        }

        // Update application with mapped data
        await base44.asServiceRole.entities.LoanApplication.update(appId, mappedData);
        updates.applications.push(appId);
      } catch (error) {
        console.error(`Error updating application ${appId}:`, error);
      }
    }

    // Update loans
    for (const loanId of loan_ids) {
      try {
        const loan = await base44.asServiceRole.entities.Loan.get(loanId);
        if (!loan) continue;

        let mappedData = {};
        
        if (profile_type === 'borrower') {
          const borrower = await base44.asServiceRole.entities.Borrower.get(profile_id);
          mappedData = syncEntities('Borrower', 'Loan', borrower, { loan });
        } else if (profile_type === 'entity') {
          const entity = await base44.asServiceRole.entities.BorrowerEntity.get(profile_id);
          mappedData = syncEntities('BorrowerEntity', 'Loan', entity, { loan });
        }

        // Update loan with mapped data
        await base44.asServiceRole.entities.Loan.update(loanId, mappedData);
        updates.loans.push(loanId);
      } catch (error) {
        console.error(`Error updating loan ${loanId}:`, error);
      }
    }

    return Response.json({ 
      success: true,
      updates
    });

  } catch (error) {
    console.error('Error propagating profile changes:', error);
    return Response.json({ 
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});
