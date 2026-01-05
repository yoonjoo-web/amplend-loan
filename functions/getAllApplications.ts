import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view all applications
    const isAdmin = user.role === 'admin' || user.app_role === 'Administrator';
    const isLoanOfficer = user.app_role === 'Loan Officer';

    if (!isAdmin && !isLoanOfficer) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch all applications using service role
    const applications = await base44.asServiceRole.entities.LoanApplication.list('-created_date');

    return Response.json({ applications });

  } catch (error) {
    console.error('Error fetching all applications:', error);
    return Response.json({ 
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});