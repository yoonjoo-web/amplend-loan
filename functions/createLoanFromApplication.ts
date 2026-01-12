import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { mapLoanApplicationToLoan } from './entitySyncHelper.ts';

Deno.serve(async (req) => {
  console.error('[createLoanFromApplication] LOG_BANNER v1');
  console.log('[createLoanFromApplication] Handler start');
  try {
    console.log('[createLoanFromApplication] Creating client from request');
    const base44 = createClientFromRequest(req);
    console.log('[createLoanFromApplication] Fetching user');
    const user = await base44.auth.me();

    if (!user) {
      console.warn('[createLoanFromApplication] Unauthorized: no user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[createLoanFromApplication] User authenticated:', user.id);
    console.log('[createLoanFromApplication] Parsing request body');
    const { application_id } = await req.json();

    if (!application_id) {
      console.warn('[createLoanFromApplication] Missing application_id');
      return Response.json({ error: 'application_id is required' }, { status: 400 });
    }
    console.log('[createLoanFromApplication] application_id:', application_id);

    // Fetch the application
    console.log('[createLoanFromApplication] Fetching LoanApplication');
    const application = await base44.asServiceRole.entities.LoanApplication.get(application_id);

    if (!application) {
      console.warn('[createLoanFromApplication] Application not found:', application_id);
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }
    console.log('[createLoanFromApplication] Application found:', application.id);

    // Generate loan number based on loan type
    console.log('[createLoanFromApplication] Generating loan number');
    const loanNumberResponse = await base44.functions.invoke('generateLoanNumber', {
      loan_product: application.loan_type
    });
    console.log('[createLoanFromApplication] Loan number response:', loanNumberResponse?.data);
    const loanNumber = loanNumberResponse.data.loan_number;
    console.log('[createLoanFromApplication] Loan number:', loanNumber);

    // Map application data to loan
    const mappedLoanData = mapLoanApplicationToLoan(application);
    console.log('[createLoanFromApplication] Mapped loan data:');
    console.log(JSON.stringify(mappedLoanData, null, 2));

    // Prepare borrower IDs array
    console.log('[createLoanFromApplication] Building borrower IDs');
    const borrowerIds = [];
    if (application.primary_borrower_id) {
      borrowerIds.push(application.primary_borrower_id);
    }
    
    // Add co-borrower IDs if they exist
    if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
      application.co_borrowers.forEach(cb => {
        if (cb.user_id) {
          borrowerIds.push(cb.user_id);
        }
      });
    }

    // Prepare loan officer IDs
    console.log('[createLoanFromApplication] Building loan officer IDs');
    const loanOfficerIds = [];
    if (application.assigned_loan_officer_id) {
      loanOfficerIds.push(application.assigned_loan_officer_id);
    }
    
    // Add current user if they're a loan officer and not already added
    if (user.app_role === 'Loan Officer' && !loanOfficerIds.includes(user.id)) {
      loanOfficerIds.push(user.id);
    }

    // Prepare referrer IDs if referrer_name exists
    console.log('[createLoanFromApplication] Resolving referrer');
    const referrerIds = [];
    let referrerUser = null;
    if (application.referrer_name) {
      // Search for matching loan partner
      const allPartners = await base44.asServiceRole.entities.LoanPartner.list();
      // Match by name (referrer_name format: "First Initial. Last Name")
      const matchingPartner = allPartners.find(p => {
        if (!p.name) return false;
        const nameParts = p.name.split(' ');
        if (nameParts.length < 2) return false;
        const firstInitial = nameParts[0].charAt(0);
        const lastName = nameParts.slice(1).join(' ');
        const referrerPattern = `${firstInitial}. ${lastName}`;
        return application.referrer_name.includes(lastName) && application.referrer_name.includes(firstInitial);
      });

      if (matchingPartner) {
        // Get user ID from partner email
        const allUsers = await base44.asServiceRole.entities.User.list();
        referrerUser = allUsers.find(u => u.email === matchingPartner.email);
        if (referrerUser) {
          referrerIds.push(referrerUser.id);
        }
      }
    }

    // Create the loan object using mapped data and additional fields
    console.log('[createLoanFromApplication] Building loan payload');
    const loanData = {
      loan_number: loanNumber,
      borrower_ids: borrowerIds,
      loan_officer_ids: loanOfficerIds,
      guarantor_ids: [],
      referrer_ids: referrerIds,
      
      // Use mapped data from helper (includes all property, financial, and borrower fields)
      ...mappedLoanData,
      
      // Additional fields not in mapping
      borrower_construction_experience: 0,
      
      // Loan details
      lien_position: '1st',
      origination_date: new Date().toISOString().split('T')[0],
      target_closing_date: application.target_closing || null,
      occupant: 'vacant',
      
      // Status
      status: 'application_submitted',
      
      // Modification history
      modification_history: [
        {
          timestamp: new Date().toISOString(),
          modified_by: 'system',
          modified_by_name: 'System',
          description: 'Loan created from application',
          fields_changed: ['created']
        }
      ]
    };

    // Create the loan
    console.log('[createLoanFromApplication] Creating loan');
    const loan = await base44.asServiceRole.entities.Loan.create(loanData);
    console.log('[createLoanFromApplication] Loan created:', loan?.id);

    // Update application status
    console.log('[createLoanFromApplication] Updating application status to approved');
    await base44.asServiceRole.entities.LoanApplication.update(application_id, {
      status: 'approved'
    });

    // Generate PDF for the application
    let pdfFileUrl = null;
    try {
      console.log('[createLoanFromApplication] Generating application PDF');
      const pdfResponse = await base44.functions.invoke('generateApplicationPDF', {
        application_id: application.id
      });

      if (pdfResponse.data && pdfResponse.data.file_url) {
        pdfFileUrl = pdfResponse.data.file_url;
        console.log('[createLoanFromApplication] PDF generated:', pdfFileUrl);
        
        // Create document record for the PDF
        console.log('[createLoanFromApplication] Creating LoanDocument for PDF');
        await base44.asServiceRole.entities.LoanDocument.create({
          loan_id: loan.id,
          document_name: `Application_${application.application_number}.pdf`,
          category: 'application',
          status: 'submitted',
          file_url: pdfFileUrl,
          uploaded_by: user.id,
          uploaded_date: new Date().toISOString(),
          notes: 'Auto-generated from application submission'
        });
      }
    } catch (pdfError) {
      console.error('Error generating application PDF:', pdfError);
      // Continue even if PDF generation fails
    }

    // Notify referrer if they exist
    if (referrerUser && referrerIds.length > 0) {
      try {
        console.log('[createLoanFromApplication] Notifying referrer:', referrerUser.id);
        const borrowerName = application.borrower_first_name && application.borrower_last_name 
          ? `${application.borrower_first_name} ${application.borrower_last_name}`
          : 'a borrower';

        // Create in-app notification
        await base44.asServiceRole.entities.Notification.create({
          user_id: referrerUser.id,
          message: `Application from ${borrowerName} that you referred has been approved and converted to loan ${loanNumber}`,
          type: 'status_change',
          entity_type: 'Loan',
          entity_id: loan.id,
          link_url: `/loan-detail?id=${loan.id}`,
          priority: 'high'
        });

        // Send email notification
        await base44.functions.invoke('emailService', {
          email_type: 'referrer_loan_approved',
          recipient_email: referrerUser.email,
          recipient_name: `${referrerUser.first_name} ${referrerUser.last_name}`,
          data: {
            borrower_name: borrowerName,
            loan_number: loanNumber,
            loan_id: loan.id,
            application_number: application.application_number
          }
        });
      } catch (notifyError) {
        console.error('Error notifying referrer:', notifyError);
        // Continue even if notification fails
      }
    }

    console.log('[createLoanFromApplication] Success response');
    return Response.json({ 
      success: true, 
      loan: loan 
    });

  } catch (error) {
    console.error('[createLoanFromApplication] Unhandled error:', error);
    return Response.json({ 
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});
