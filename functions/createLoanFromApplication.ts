import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Inline helper function for deployment
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function toInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function toBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'yes' || lower === 'true' || lower === '1') return true;
    if (lower === 'no' || lower === 'false' || lower === '0') return false;
  }
  return null;
}


function normalizeEnumValue(value, validValues) {
  if (!value) return null;
  const normalized = String(value).toLowerCase().trim();
  const match = validValues.find(v => v.toLowerCase() === normalized);
  return match || null;
}

function mapLoanApplicationToLoan(application) {
  if (!application) return {};

  const loanProduct = normalizeEnumValue(application.loan_type, ['bridge', 'new_construction', 'fix_flip', 'dscr']);
  const loanPurpose = normalizeEnumValue(application.loan_purpose, ['purchase', 'refinance', 'cash_out_refinance', 'rate_term_refinance']);
  const borrowerType = normalizeEnumValue(application.borrower_type, ['individual', 'entity']);

  let borrowerEntityName = null;
  if (borrowerType === 'entity') {
    borrowerEntityName = application.entity_name;
  } else if (borrowerType === 'individual') {
    if (application.borrower_first_name && application.borrower_last_name) {
      borrowerEntityName = `${application.borrower_first_name} ${application.borrower_last_name}`;
    }
  }

  const mapping = {
    loan_product: loanProduct,
    loan_purpose: loanPurpose,
    borrower_type: borrowerType,
    borrower_entity_name: borrowerEntityName,
    state_of_organization: application.entity_type || null,
    borrower_email: application.borrower_email || null,
    borrower_phone: application.borrower_phone || null,
    borrower_rehab_experience: toInteger(application.borrower_rehabs_done_36_months),
    borrower_liquidity: toNumber(application.borrower_liquidity_amount),
    
    borrower_billing_address_street: application.borrower_address_street || "null",
    borrower_billing_address_unit: application.borrower_address_unit || null,
    borrower_billing_address_city: application.borrower_address_city || null,
    borrower_billing_address_state: application.borrower_address_state || null,
    borrower_billing_address_zip: application.borrower_address_zip || null,
  };

  const addressParts = [
    application.property_address_street,
    application.property_address_city,
    application.property_address_state,
    application.property_address_zip,
  ].filter(Boolean);
  
  if (addressParts.length > 0) {
    mapping.property_address = addressParts.join(', ');
  }

  const individualInfo = [];
  
  if (application.borrower_first_name || application.borrower_last_name) {
    individualInfo.push({
      last_name: application.borrower_last_name,
      individual_email: application.borrower_email,
      individual_phone_number: application.borrower_phone,
      rehab_experience: toInteger(application.borrower_rehabs_done_36_months),
      credit_score_median: toNumber(application.borrower_credit_score),
      foreign_national: toBoolean(application.us_citizen === 'no'),
      individual_construction_experience: 0,
      ownership_of_entity: 0,
      guarantor: 'false',
      bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months: toBoolean(application.bankruptcy_36_months === 'yes'),
      mortgage_late_payment_or_delinquencies: toBoolean(application.mortgage_late === 'yes'),
      previous_felony_misdemeanor_convictions_or_other_similar_crimes: toBoolean(application.felony_convictions === 'yes'),
    });
  }

  if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
    application.co_borrowers.forEach((coBorrower) => {
      individualInfo.push({
        first_name: coBorrower.first_name,
        last_name: coBorrower.last_name,
        individual_email: coBorrower.email,
        individual_phone_number: coBorrower.phone,
        rehab_experience: toInteger(coBorrower.rehabs_done_36_months),
        credit_score_median: toNumber(coBorrower.credit_score),
        foreign_national: toBoolean(coBorrower.us_citizen === 'no'),
        individual_construction_experience: 0,
        ownership_of_entity: 0,
        guarantor: 'false',
        bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months: toBoolean(coBorrower.bankruptcy_36_months === 'yes'),
        mortgage_late_payment_or_delinquencies: toBoolean(coBorrower.mortgage_late === 'yes'),
        previous_felony_misdemeanor_convictions_or_other_similar_crimes: toBoolean(coBorrower.felony_convictions === 'yes'),
      });
    });
  }

  if (individualInfo.length > 0) {
    mapping.individual_information = individualInfo;
  }

  let totalLiquidity = toNumber(application.borrower_liquidity_amount) || 0;
  if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
    totalLiquidity += application.co_borrowers.reduce(
      (sum, cb) => sum + (toNumber(cb.liquidity_amount) || 0),
      0
    );
  }
  mapping.borrower_liquidity = totalLiquidity;
  
  mapping.property_address_unit = application.property_address_unit || null;
  mapping.property_city = application.property_address_city || null;
  mapping.property_state = application.property_address_state || null;
  mapping.property_zip = application.property_address_zip || null;
  mapping.property_county = application.property_county || null;
  mapping.property_type = normalizeEnumValue(application.property_type, ['single_family', '2_4_unit', 'multifamily_5plus_unit', 'condo_warrantable']) || 'single_family';
  mapping.number_of_units = toInteger(application.number_of_units) || 1;
  
  mapping.as_is_appraisal_value = toNumber(application.estimated_value);
  mapping.after_repair_appraisal_value = toNumber(application.after_repair_value);
  mapping.purchase_price = toNumber(application.purchase_price);
  mapping.initial_loan_amount = toNumber(application.desired_loan_amount);
  mapping.total_loan_amount = toNumber(application.desired_loan_amount);
  mapping.total_rehab_budget = toNumber(application.rehab_budget);
  mapping.gross_potential_rent = toNumber(application.estimated_monthly_rent);
  mapping.annual_property_taxes = toNumber(application.monthly_property_tax) ? toNumber(application.monthly_property_tax) * 12 : null;
  mapping.annual_insurance = toNumber(application.monthly_insurance) ? toNumber(application.monthly_insurance) * 12 : null;
  mapping.annual_hoa = toNumber(application.monthly_hoa_fees) ? toNumber(application.monthly_hoa_fees) * 12 : null;

  return mapping;
}

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
      return Response.json({ error: 'Unauthorized', marker: 'createLoanFromApplication_v1' }, { status: 401 });
    }

    console.log('[createLoanFromApplication] User authenticated:', user.id);
    console.log('[createLoanFromApplication] Parsing request body');
    const { application_id } = await req.json();

    if (!application_id) {
      console.warn('[createLoanFromApplication] Missing application_id');
      return Response.json({ error: 'application_id is required', marker: 'createLoanFromApplication_v1' }, { status: 400 });
    }
    console.log('[createLoanFromApplication] application_id:', application_id);

    // Fetch the application
    console.log('[createLoanFromApplication] Fetching LoanApplication');
    const application = await base44.asServiceRole.entities.LoanApplication.get(application_id);

    if (!application) {
      console.warn('[createLoanFromApplication] Application not found:', application_id);
      return Response.json({ error: 'Application not found', marker: 'createLoanFromApplication_v1' }, { status: 404 });
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
      origination_date: null,
      first_payment_date: null,
      maturity_date: null,
      target_closing_date: application.target_closing || null,
      extended_maturity_date: null,
      good_through_date: null,
      loan_sale_closing_date: null,
      loan_purchase_date: null,
      appraisal_date: null,
      appraisal_expiration_date: null,
      original_purchase_date: null,
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
      marker: 'createLoanFromApplication_v1',
      debug: {
        borrower_first_name: application.borrower_first_name,
        borrower_last_name: application.borrower_last_name,
        co_borrowers: Array.isArray(application.co_borrowers)
          ? application.co_borrowers.map((cb) => ({
              first_name: cb.first_name,
              last_name: cb.last_name,
              email: cb.email
            }))
          : application.co_borrowers,
        mapped_individual_information: mappedLoanData.individual_information
      },
      loan: loan 
    });

  } catch (error) {
    console.error('[createLoanFromApplication] Unhandled error:', error);
    return Response.json({ 
      error: error.message || 'Unknown error',
      marker: 'createLoanFromApplication_v1'
    }, { status: 500 });
  }
});