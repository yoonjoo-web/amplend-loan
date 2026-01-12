/**
 * Entity Sync Helper for Backend Functions
 * Simplified version for use in Deno backend functions
 */

// ==================== TYPE CONVERTERS ====================

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

// ==================== LOAN APPLICATION → LOAN ====================

export function mapLoanApplicationToLoan(application) {
  if (!application) return {};

  // Normalize enum values
  const loanProduct = normalizeEnumValue(application.loan_type, ['bridge', 'new_construction', 'fix_flip', 'dscr']);
  const loanPurpose = normalizeEnumValue(application.loan_purpose, ['purchase', 'refinance', 'cash_out_refinance', 'rate_term_refinance']);
  const borrowerType = normalizeEnumValue(application.borrower_type, ['individual', 'entity']);

  // Set borrower_entity_name based on borrower_type
  let borrowerEntityName = null;
  if (borrowerType === 'entity') {
    borrowerEntityName = application.entity_name;
  } else if (borrowerType === 'individual') {
    // Use primary borrower's name
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
    
    // Borrower Billing Address
    borrower_billing_address_street: application.borrower_address_street || "null",
    borrower_billing_address_unit: application.borrower_address_unit || null,
    borrower_billing_address_city: application.borrower_address_city || null,
    borrower_billing_address_state: application.borrower_address_state || null,
    borrower_billing_address_zip: application.borrower_address_zip || null,
  };

  // Map property address (concatenated)
  const addressParts = [
    application.property_address_street,
    application.property_address_city,
    application.property_address_state,
    application.property_address_zip,
  ].filter(Boolean);
  
  if (addressParts.length > 0) {
    mapping.property_address = addressParts.join(', ');
  }

  // Map primary borrower to individual_information[0]
  const individualInfo = [];
  
  if (application.borrower_first_name || application.borrower_last_name) {
    individualInfo.push({
      // INTENTIONALLY COMMENTED OUT - DO NOT MAP first_name
      // first_name: application.borrower_first_name,
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

  // Map co-borrowers to individual_information[1+]
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

  // Calculate total borrower liquidity
  let totalLiquidity = toNumber(application.borrower_liquidity_amount) || 0;
  if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
    totalLiquidity += application.co_borrowers.reduce(
      (sum, cb) => sum + (toNumber(cb.liquidity_amount) || 0),
      0
    );
  }
  mapping.borrower_liquidity = totalLiquidity;
  
  // Property information with type conversion
  mapping.property_address_unit = application.property_address_unit || null;
  mapping.property_city = application.property_address_city || null;
  mapping.property_state = application.property_address_state || null;
  mapping.property_zip = application.property_address_zip || null;
  mapping.property_county = application.property_county || null;
  mapping.property_type = normalizeEnumValue(application.property_type, ['single_family', '2_4_unit', 'multifamily_5plus_unit', 'condo_warrantable']) || 'single_family';
  mapping.number_of_units = toInteger(application.number_of_units) || 1;
  
  // Financial information with type conversion
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