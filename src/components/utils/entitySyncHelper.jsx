/**
 * Centralized Entity Synchronization Helper
 * 
 * This file contains all cross-entity autopopulation and update rules.
 * Every component should use these pure mapping functions to sync data
 * between entities, ensuring a single source of truth.
 */

// ==================== TYPE CONVERTERS ====================

/**
 * Convert string/number to proper number type
 */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Convert string/number to integer
 */
function toInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

/**
 * Convert various formats to date string (YYYY-MM-DD)
 */
function toDateString(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.split('T')[0];
  }
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Convert boolean to yes/no string
 */
function toYesNo(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'yes' || lower === 'true' || lower === '1') return 'yes';
    if (lower === 'no' || lower === 'false' || lower === '0') return 'no';
  }
  return null;
}

/**
 * Convert yes/no string to boolean
 */
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

/**
 * Normalize string to proper enum value
 */
function normalizeEnumValue(value, validValues) {
  if (!value) return null;
  const normalized = String(value).toLowerCase().trim();
  const match = validValues.find(v => v.toLowerCase() === normalized);
  return match || null;
}

// ==================== BORROWER → LOAN APPLICATION ====================

export function mapBorrowerToLoanApplication(borrower) {
  if (!borrower) return {};

  return {
    borrower_first_name: borrower.first_name,
    borrower_last_name: borrower.last_name,
    borrower_email: borrower.email,
    borrower_phone: borrower.phone,

    borrower_address_street: borrower.address_street,
    borrower_address_unit: borrower.address_unit,
    borrower_address_city: borrower.address_city,
    borrower_address_state: borrower.address_state,
    borrower_address_zip: borrower.address_zip,

    borrower_mailing_address_street: borrower.mailing_address_street,
    borrower_mailing_address_unit: borrower.mailing_address_unit,
    borrower_mailing_address_city: borrower.mailing_address_city,
    borrower_mailing_address_state: borrower.mailing_address_state,
    borrower_mailing_address_zip: borrower.mailing_address_zip,

    borrower_date_of_birth: toDateString(borrower.date_of_birth),
    borrower_ssn: borrower.ssn,
    borrower_annual_gross_income: toNumber(borrower.annual_gross_income),
    borrower_liquidity_amount: toNumber(borrower.liquidity_amount),
    borrower_rehabs_done_36_months: toInteger(borrower.rehabs_done_36_months),
    borrower_rentals_owned_36_months: toInteger(borrower.rentals_owned_36_months),
    borrower_credit_score: toNumber(borrower.credit_score),
  };
}

// ==================== BORROWER ENTITY → LOAN APPLICATION ====================

export function mapBorrowerEntityToLoanApplication(entity) {
  if (!entity) return {};

  const baseMapping = {
    entity_name: entity.entity_name,
    entity_ein: entity.registration_number,
    entity_type: entity.entity_type,

    entity_address_street: entity.address_street,
    entity_address_unit: entity.address_unit,
    entity_address_city: entity.address_city,
    entity_address_state: entity.address_state,
    entity_address_zip: entity.address_zip,

    entity_mailing_address_street: entity.mailing_address_street,
    entity_mailing_address_unit: entity.mailing_address_unit,
    entity_mailing_address_city: entity.mailing_address_city,
    entity_mailing_address_state: entity.mailing_address_state,
    entity_mailing_address_zip_code: entity.mailing_address_zip,
  };

  // Map ownership structure to entity owners
  if (entity.ownership_structure && Array.isArray(entity.ownership_structure)) {
    baseMapping.entity_owners = entity.ownership_structure.map((owner) => ({
      borrower_id: owner.borrower_id,
      name: owner.owner_name,
      ownership_percentage: owner.ownership_percentage,
    }));
  }

  return baseMapping;
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
    borrower_billing_address_street: application.borrower_address_street || null,
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
      first_name: application.borrower_first_name,
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

// ==================== BORROWER → LOAN ====================

export function mapBorrowerToLoan(borrower, loan) {
  if (!borrower) return {};

  const mapping = {
    individual_information: [
      {
        first_name: borrower.first_name,
        last_name: borrower.last_name,
        individual_email: borrower.email,
        individual_phone_number: borrower.phone,
        rehab_experience: toInteger(borrower.rehabs_done_36_months),
        credit_score_median: toNumber(borrower.credit_score),
      },
    ],
  };

  // Conditional: only map billing address if borrower_type is "individual"
  if (loan && loan.borrower_type === 'individual') {
    mapping.borrower_billing_address_street = borrower.address_street;
    mapping.borrower_billing_address_unit = borrower.address_unit;
    mapping.borrower_billing_address_city = borrower.address_city;
    mapping.borrower_billing_address_state = borrower.address_state;
    mapping.borrower_billing_address_zip = borrower.address_zip;
  }

  return mapping;
}

// ==================== BORROWER ENTITY → LOAN ====================

export function mapBorrowerEntityToLoan(entity, loan) {
  if (!entity) return {};

  const mapping = {
    borrower_entity_name: entity.entity_name,
    borrower_email: entity.email,
    borrower_phone: entity.phone,
  };

  // Conditional: only map billing address if borrower_type is "entity"
  if (loan && loan.borrower_type === 'entity') {
    mapping.borrower_billing_address_street = entity.address_street;
    mapping.borrower_billing_address_unit = entity.address_unit;
    mapping.borrower_billing_address_city = entity.address_city;
    mapping.borrower_billing_address_state = entity.address_state;
    mapping.borrower_billing_address_zip = entity.address_zip;
  }

  // Map ownership structure to individual_information ownership percentages
  if (entity.ownership_structure && Array.isArray(entity.ownership_structure)) {
    const individualInfo = entity.ownership_structure.map((owner) => ({
      first_name: owner.owner_name ? owner.owner_name.split(' ')[0] : '',
      last_name: owner.owner_name ? owner.owner_name.split(' ').slice(1).join(' ') : '',
      ownership_of_entity: toNumber(owner.ownership_percentage),
    }));
    
    if (individualInfo.length > 0) {
      mapping.individual_information = individualInfo;
    }
  }

  return mapping;
}

// ==================== DISPATCHER ====================

/**
 * Main dispatcher function that routes sync operations to the appropriate mapper
 * 
 * @param {string} sourceEntity - The source entity type (e.g., 'Borrower', 'BorrowerEntity', 'LoanApplication')
 * @param {string} targetEntity - The target entity type (e.g., 'LoanApplication', 'Loan')
 * @param {object} sourceData - The source entity data
 * @param {object} contextData - Additional context data (e.g., existing loan data for conditional mapping)
 * @returns {object} Mapped data for the target entity
 */
export function syncEntities(sourceEntity, targetEntity, sourceData, contextData = {}) {
  const key = `${sourceEntity}_to_${targetEntity}`;

  switch (key) {
    case 'Borrower_to_LoanApplication':
      return mapBorrowerToLoanApplication(sourceData);

    case 'BorrowerEntity_to_LoanApplication':
      return mapBorrowerEntityToLoanApplication(sourceData);

    case 'LoanApplication_to_Loan':
      return mapLoanApplicationToLoan(sourceData);

    case 'Borrower_to_Loan':
      return mapBorrowerToLoan(sourceData, contextData.loan);

    case 'BorrowerEntity_to_Loan':
      return mapBorrowerEntityToLoan(sourceData, contextData.loan);

    default:
      console.warn(`No mapping defined for ${sourceEntity} → ${targetEntity}`);
      return {};
  }
}

/**
 * Batch sync multiple source entities to a target
 * 
 * @param {Array} mappings - Array of {sourceEntity, targetEntity, sourceData, contextData}
 * @returns {object} Combined mapped data
 */
export function syncEntitiesBatch(mappings) {
  return mappings.reduce((acc, mapping) => {
    const result = syncEntities(
      mapping.sourceEntity,
      mapping.targetEntity,
      mapping.sourceData,
      mapping.contextData
    );
    return { ...acc, ...result };
  }, {});
}