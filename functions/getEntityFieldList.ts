import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Mapping of field names to categories for applications
const APPLICATION_FIELD_CATEGORIES = {
  // Loan Type
  borrower_type: { category: 'loan_type', display_name: 'Loan Type' },
  has_coborrowers: { category: 'loan_type', display_name: 'Loan Type' },
  loan_purpose: { category: 'loan_type', display_name: 'Loan Type' },
  // Loan Information
  application_number: { category: 'loanInformation', display_name: 'Loan Information' },
  loan_type: { category: 'loanInformation', display_name: 'Loan Information' },
  desired_loan_amount: { category: 'loanInformation', display_name: 'Loan Information' },
  existing_mortgage_balance: { category: 'loanInformation', display_name: 'Loan Information' },
  target_closing: { category: 'loanInformation', display_name: 'Loan Information' },
  investment_strategy: { category: 'loanInformation', display_name: 'Loan Information' },
  exit_strategy: { category: 'loanInformation', display_name: 'Loan Information' },
  how_did_you_hear: { category: 'loanInformation', display_name: 'Loan Information' },
  how_did_you_hear_other: { category: 'loanInformation', display_name: 'Loan Information' },
  // Borrower Information
  borrower_first_name: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_last_name: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_email: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_phone: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_ssn: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_date_of_birth: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_address_street: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_address_unit: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_address_city: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_address_state: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_address_zip: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_mailing_address_street: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_mailing_address_unit: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_mailing_address_city: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_mailing_address_state: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_mailing_address_zip: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_annual_gross_income: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_liquidity_amount: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_rehabs_done_36_months: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_rentals_owned_36_months: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  borrower_credit_score: { category: 'borrowerInformation', display_name: 'Borrower Information' },
  // Entity Information
  entity_name: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_ein: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_type: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_address_street: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_address_unit: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_address_city: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_address_state: { category: 'entityInformation', display_name: 'Entity Information' },
  entity_address_zip: { category: 'entityInformation', display_name: 'Entity Information' },
  // Property Information
  property_address_street: { category: 'propertyInformation', display_name: 'Property Information' },
  property_address_unit: { category: 'propertyInformation', display_name: 'Property Information' },
  property_address_city: { category: 'propertyInformation', display_name: 'Property Information' },
  property_address_state: { category: 'propertyInformation', display_name: 'Property Information' },
  property_address_zip: { category: 'propertyInformation', display_name: 'Property Information' },
  property_type: { category: 'propertyInformation', display_name: 'Property Information' },
  number_of_units: { category: 'propertyInformation', display_name: 'Property Information' },
  number_of_leased_units: { category: 'propertyInformation', display_name: 'Property Information' },
  renovating: { category: 'propertyInformation', display_name: 'Property Information' },
  expansion_over_20_percent: { category: 'propertyInformation', display_name: 'Property Information' },
  purchase_price: { category: 'propertyInformation', display_name: 'Property Information' },
  estimated_value: { category: 'propertyInformation', display_name: 'Property Information' },
  after_repair_value: { category: 'propertyInformation', display_name: 'Property Information' },
  rehab_budget: { category: 'propertyInformation', display_name: 'Property Information' },
  completed_improvements: { category: 'propertyInformation', display_name: 'Property Information' },
  estimated_monthly_rent: { category: 'propertyInformation', display_name: 'Property Information' },
  monthly_property_tax: { category: 'propertyInformation', display_name: 'Property Information' },
  monthly_insurance: { category: 'propertyInformation', display_name: 'Property Information' },
  monthly_hoa_fees: { category: 'propertyInformation', display_name: 'Property Information' },
  purchase_date: { category: 'propertyInformation', display_name: 'Property Information' },
  contact_person_at_property: { category: 'propertyInformation', display_name: 'Property Information' },
  contact_phone_at_property: { category: 'propertyInformation', display_name: 'Property Information' },
  contact_email_at_property: { category: 'propertyInformation', display_name: 'Property Information' },
  property_accessible: { category: 'propertyInformation', display_name: 'Property Information' },
  // Disclosures
  outstanding_judgments: { category: 'disclosures', display_name: 'Disclosures' },
  bankruptcy_36_months: { category: 'disclosures', display_name: 'Disclosures' },
  foreclosure_36_months: { category: 'disclosures', display_name: 'Disclosures' },
  lawsuit: { category: 'disclosures', display_name: 'Disclosures' },
  mortgage_late: { category: 'disclosures', display_name: 'Disclosures' },
  down_payment_borrowed: { category: 'disclosures', display_name: 'Disclosures' },
  felony_convictions: { category: 'disclosures', display_name: 'Disclosures' },
  us_citizen: { category: 'disclosures', display_name: 'Disclosures' },
  primary_residence: { category: 'disclosures', display_name: 'Disclosures' },
};

const LOAN_FIELD_CATEGORIES = {
  loan_number: { category: 'loanDetails', display_name: 'Loan Details' },
  loan_product: { category: 'loanDetails', display_name: 'Loan Details' },
  loan_purpose: { category: 'loanDetails', display_name: 'Loan Details' },
  lien_position: { category: 'loanDetails', display_name: 'Loan Details' },
  origination_date: { category: 'loanDetails', display_name: 'Loan Details' },
  loan_term_months: { category: 'loanDetails', display_name: 'Loan Details' },
  first_payment_date: { category: 'loanDetails', display_name: 'Loan Details' },
  maturity_date: { category: 'loanDetails', display_name: 'Loan Details' },
  recourse: { category: 'loanDetails', display_name: 'Loan Details' },
  interest_rate: { category: 'loanDetails', display_name: 'Loan Details' },
  monthly_payment: { category: 'loanDetails', display_name: 'Loan Details' },
  initial_loan_amount: { category: 'loanDetails', display_name: 'Loan Details' },
  total_loan_amount: { category: 'loanDetails', display_name: 'Loan Details' },
  rate_type: { category: 'loanDetails', display_name: 'Loan Details' },
  accrual_type: { category: 'loanDetails', display_name: 'Loan Details' },
  property_address: { category: 'propertyDetails', display_name: 'Property Details' },
  property_city: { category: 'propertyDetails', display_name: 'Property Details' },
  property_state: { category: 'propertyDetails', display_name: 'Property Details' },
  property_zip: { category: 'propertyDetails', display_name: 'Property Details' },
  property_county: { category: 'propertyDetails', display_name: 'Property Details' },
  property_type: { category: 'propertyDetails', display_name: 'Property Details' },
  number_of_units: { category: 'propertyDetails', display_name: 'Property Details' },
  as_is_appraisal_value: { category: 'propertyDetails', display_name: 'Property Details' },
  after_repair_appraisal_value: { category: 'propertyDetails', display_name: 'Property Details' },
  purchase_price: { category: 'propertyDetails', display_name: 'Property Details' },
  annual_property_taxes: { category: 'propertyDetails', display_name: 'Property Details' },
  annual_insurance: { category: 'propertyDetails', display_name: 'Property Details' },
  warehouse_lender: { category: 'postCloseDetails', display_name: 'Post-Close Details' },
  servicer: { category: 'postCloseDetails', display_name: 'Post-Close Details' },
  loan_sale_closing_date: { category: 'postCloseDetails', display_name: 'Post-Close Details' },
  loan_buyer: { category: 'postCloseDetails', display_name: 'Post-Close Details' },
  recorded_mortgage: { category: 'postCloseDetails', display_name: 'Post-Close Details' },
};

const SKIP_FIELDS = [
  'id', 'created_date', 'updated_date', 'created_by',
  'status', 'current_step', 'submission_count',
  'assigned_loan_officer_id', 'primary_borrower_id',
  'borrower_entity_id', 'has_coborrowers',
  'co_borrowers', 'entity_owners', 
  'field_comments', 'overall_review_comment',
  'esignature', 'esignature_date',
  'acknowledgement_agreed', 'authorization_agreed',
  'rejection_reason', 'notes', 'overridden_fields',
  'borrower_completion_status', 'borrower_invitation_status',
  'borrower_ids', 'loan_officer_ids', 'guarantor_ids',
  'broker_id', 'referrer_id', 'liaison_id',
  'individuals', 'draws', 'loan_partners', 'unit_information',
  'modification_history'
];

function fieldNameToLabel(fieldName) {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mapSchemaToFieldType(property) {
  if (property.enum && property.enum.length > 0) {
    return 'select';
  }
  if (property.type === 'boolean') {
    return 'checkbox';
  }
  if (property.type === 'number' || property.type === 'integer') {
    return 'number';
  }
  if (property.type === 'string') {
    if (property.format === 'email') return 'email';
    if (property.format === 'date') return 'date';
    if (property.format === 'date-time') return 'datetime';
    return 'text';
  }
  return 'text';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if user is authenticated
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.error('Authentication error:', authError);
      return Response.json({ 
        success: false,
        error: 'Unauthorized - Please log in' 
      }, { status: 401 });
    }

    if (!user) {
      return Response.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Parse request body
    let context;
    try {
      const body = await req.json();
      context = body.context;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return Response.json({ 
        success: false,
        error: 'Invalid request body - must be JSON' 
      }, { status: 400 });
    }
    
    if (!context || !['application', 'loan'].includes(context)) {
      return Response.json({ 
        success: false,
        error: 'Invalid context. Must be "application" or "loan"' 
      }, { status: 400 });
    }

    console.log(`Loading fields for context: ${context}`);

    const entityName = context === 'application' ? 'LoanApplication' : 'Loan';
    const categoryMap = context === 'application' ? APPLICATION_FIELD_CATEGORIES : LOAN_FIELD_CATEGORIES;
    
    // Load existing field configurations
    let customizations = [];
    try {
      customizations = await base44.asServiceRole.entities.FieldConfiguration.filter({ context });
      console.log(`Loaded ${customizations.length} existing field configurations`);
    } catch (customError) {
      console.error('Error loading field configurations:', customError);
      // Continue without customizations - we'll just return schema-based fields
    }

    // Build a map of existing customizations
    const customizationsMap = {};
    customizations.forEach(config => {
      customizationsMap[config.field_name] = config;
    });

    // Get all schema fields from the category map
    const fields = [];
    let displayOrder = 0;

    // Add all fields from customizations first (these are user-configured or already initialized)
    customizations.forEach(config => {
      if (Array.isArray(config.visible_to_roles)) {
        config.visible_to_roles = config.visible_to_roles.filter(role => role !== 'Guarantor');
      }
      fields.push({
        ...config,
        _isFromSchema: false
      });
    });

    // Return the fields sorted by display order
    fields.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    console.log(`Returning ${fields.length} field configurations`);

    return Response.json({
      success: true,
      fields,
      context
    });

  } catch (error) {
    console.error('Error in getEntityFieldList:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack
    }, { status: 500 });
  }
});
