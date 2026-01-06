/**
 * Centralized Entity Synchronization Helper
 * 
 * This file contains all cross-entity autopopulation and update rules.
 * Every component should use these pure mapping functions to sync data
 * between entities, ensuring a single source of truth.
 */

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

    borrower_date_of_birth: borrower.date_of_birth,
    borrower_ssn: borrower.ssn,
    borrower_annual_gross_income: borrower.annual_gross_income,
    borrower_liquidity_amount: borrower.liquidity_amount,
    borrower_rehabs_done_36_months: borrower.rehabs_done_36_months,
    borrower_rentals_owned_36_months: borrower.rentals_owned_36_months,
    borrower_credit_score: borrower.credit_score,
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

export function mapLoanApplicationToLoan(application, existingLoan = null) {
  if (!application) return {};

  const mapping = {

    // Loan Base
    loan_product: application.loan_type,
    loan_purpose: application.loan_purpose, // conditional (DSCR)
    borrower_type: application.borrower_type,
    borrower_entity_name: application.entity_name,
    //borrower_comment: application.() //there's no dynamic field in the schema yet
  };

  // Borrower Address
  if (application.borrower_type == "entity") {
    mapping.borrower_billing_address_street = application.entity_address_street;
    mapping.borrower_billing_address_unit = application.entity_address_unit;
    mapping.borrower_billing_address_city = application.entity_address_city;
    mapping.borrower_billing_address_state = application.entity_address_state;
    mapping.borrower_billing_address_zip = application.entity_address_zip;
  } else {
    mapping.borrower_billing_address_street = application.borrower_address_street;
    mapping.borrower_billing_address_unit = application.borrower_address_unit;
    mapping.borrower_billing_address_city = application.borrower_address_city;
    mapping.borrower_billing_address_state = application.borrower_address_state;
    mapping.borrower_billing_address_zip = application.borrower_address_zip;
  }

  // Property address (concatenated)
  const addressParts = [
    application.property_address_street,
    application.property_address_city,
    application.property_address_state,
    application.property_address_zip,
  ].filter(Boolean);
  
  if (addressParts.length > 0) {
    mapping.property_address = addressParts.join(', ');
  }

  // Individual information
  const individualInfo = [];
  
  // Primary Borrower
  if (application.borrower_first_name || application.borrower_last_name) {
    individualInfo.push({
      first_name: application.borrower_first_name,
      last_name: application.borrower_last_name,
      individual_email: application.borrower_email,
      individual_phone_number: application.borrower_phone,
      rehab_experience: application.borrower_rehabs_done_36_months || 0,
      credit_score_median: application.borrower_credit_score || 0,
      foreign_national: application.us_citizen === 'no',
      ownership_of_entity: application.entity_owners?.[0]?.ownership_percentage || 0,
      bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months: application.bankruptcy_36_months,
      mortgage_late_payment_or_delinquencies: application.mortgage_late,
      previous_felony_misdemeanor_convictions_or_other_similar_crimes: application.felony_convictions,
    });
  }
  // Co-Borrowers
  if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
    application.co_borrowers.forEach((coBorrower, index) => {
      individualInfo.push({
        first_name: coBorrower.first_name,
        last_name: coBorrower.last_name,
        individual_email: coBorrower.email,
        individual_phone_number: coBorrower.phone,
        rehab_experience: coBorrower.rehabs_done_36_months || 0,
        credit_score_median: coBorrower.credit_score || 0,
        foreign_national: coBorrower.us_citizen === 'no',
        ownership_of_entity: application.entity_owners?.[index + 1]?.ownership_percentage || 0,
        bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months: coBorrower.bankruptcy_36_months,
        mortgage_late_payment_or_delinquencies: coBorrower.mortgage_late,
        previous_felony_misdemeanor_convictions_or_other_similar_crimes: coBorrower.felony_convictions,
      });
    });
  }

  if (individualInfo.length > 0) {
    mapping.individual_information = individualInfo;
  }

  // Calculate total borrower liquidity
  let totalLiquidity = application.borrower_liquidity_amount || 0;
  if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
    totalLiquidity += application.co_borrowers.reduce(
      (sum, cb) => sum + (cb.liquidity_amount || 0),
      0
    );
  }
  mapping.borrower_liquidity = totalLiquidity;

  return mapping;
}

// ==================== BORROWER → LOAN ====================

export function mapBorrowerToLoan(borrower, loan) {
  if (!borrower) return {};

  const mapping = {};
  
  // Map to individual_information array
  mapping.individual_information = [
    {
      first_name: borrower.first_name,
      last_name: borrower.last_name,
      individual_email: borrower.email,
      individual_phone_number: borrower.phone,
      rehab_experience: borrower.rehabs_done_36_months || 0,
      credit_score_median: borrower.credit_score || 0,
      individual_construction_experience: 0,
      ownership_of_entity: 0,
      guarantor: 'false',
      bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months: false,
      foreign_national: false,
      mortgage_late_payment_or_delinquencies: false,
      previous_felony_misdemeanor_convictions_or_other_similar_crimes: false,
      credit_report_date: null,
      credit_expiration_date: null,
      individual_comment: null
    }
  ];

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

  // Map ownership structure to individual_information
  if (entity.ownership_structure && Array.isArray(entity.ownership_structure)) {
    const individualInfo = entity.ownership_structure.map((owner) => ({
      first_name: owner.owner_name?.split(' ')[0] || '',
      last_name: owner.owner_name?.split(' ').slice(1).join(' ') || '',
      ownership_of_entity: owner.ownership_percentage || 0,
      individual_email: '',
      individual_phone_number: '',
      rehab_experience: 0,
      credit_score_median: 0,
      individual_construction_experience: 0,
      guarantor: 'false',
      bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months: false,
      foreign_national: false,
      mortgage_late_payment_or_delinquencies: false,
      previous_felony_misdemeanor_convictions_or_other_similar_crimes: false,
      credit_report_date: null,
      credit_expiration_date: null,
      individual_comment: null
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
      return mapLoanApplicationToLoan(sourceData, contextData.loan);

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