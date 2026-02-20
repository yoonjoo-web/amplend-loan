import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await req.json();
    const { application_id } = body;
    
    if (!application_id) {
      return Response.json({ error: 'application_id is required' }, { status: 400 });
    }

    // Fetch the application
    let application;
    try {
      application = await base44.asServiceRole.entities.LoanApplication.get(application_id);
    } catch (error) {
      console.error('Error fetching application:', error);
      return Response.json({ 
        error: 'Application not found',
        details: error.message 
      }, { status: 404 });
    }
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Check access permissions
    const isAdmin = user.role === 'admin' || user.app_role === 'Administrator';
    const isLoanOfficer = user.app_role === 'Loan Officer';
    const isAssignedOfficer = application.assigned_loan_officer_id === user.id;
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

    const isPrimaryBorrower = application.primary_borrower_id === user.id || application.primary_borrower_id === borrowerContactId;
    const createdById = typeof application.created_by === 'object'
      ? application.created_by?.id
      : application.created_by;
    const isCreator = createdById === user.id;
    
    // Check if user is a co-borrower
    let isCoBorrower = false;
    if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
      isCoBorrower = application.co_borrowers.some(cb =>
        cb.user_id === user.id || cb.borrower_id === borrowerContactId
      );
    }

    // Grant access if:
    // - User is admin or administrator (full access)
    // - User is the assigned loan officer
    // - User is the primary borrower
    // - User is a co-borrower
    const hasAccess = isAdmin || isAssignedOfficer || isPrimaryBorrower || isCoBorrower || isCreator;

    if (!hasAccess) {
      return Response.json({ 
        error: 'You do not have permission to access this application' 
      }, { status: 403 });
    }

    return Response.json({ 
      application,
      user_role: user.app_role,
      can_manage: isAdmin || isLoanOfficer
    });

  } catch (error) {
    console.error('Error in getApplicationWithAccess:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message || error.toString()
    }, { status: 500 });
  }
});
