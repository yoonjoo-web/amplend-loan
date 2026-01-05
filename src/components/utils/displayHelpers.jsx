/**
 * Utility functions to convert enum values to human-readable labels
 */

// Loan type labels
const loanTypeLabels = {
  'fix_flip': 'Fix & Flip',
  'bridge': 'Bridge Loan',
  'new_construction': 'New Construction',
  'dscr': 'DSCR'
};

// Status labels
const statusLabels = {
  'draft': 'Draft',
  'in_review': 'In Review',
  'submitted': 'Submitted',
  'under_review': 'Under Review',
  'requires_review': 'Requires Review',
  'review_completed': 'Review Completed',
  'approved': 'Approved',
  'rejected': 'Rejected'
};

// Status colors (Tailwind classes for badges)
const statusColors = {
  'draft': 'bg-slate-100 text-slate-800',
  'in_review': 'bg-blue-100 text-blue-800',
  'submitted': 'bg-purple-100 text-purple-800',
  'under_review': 'bg-amber-100 text-amber-800',
  'requires_review': 'bg-orange-100 text-orange-800',
  'review_completed': 'bg-cyan-100 text-cyan-800',
  'approved': 'bg-emerald-100 text-emerald-800',
  'rejected': 'bg-red-100 text-red-800'
};

// Property type labels
const propertyTypeLabels = {
  'single_family': 'Single Family',
  'condo': 'Condo',
  'townhouse': 'Townhouse',
  'multi_family': 'Multi-Family',
  'commercial': 'Commercial'
};

// Employment status labels
const employmentStatusLabels = {
  'employed': 'Employed',
  'self_employed': 'Self-Employed',
  'unemployed': 'Unemployed',
  'retired': 'Retired',
  'student': 'Student'
};

// Loan purpose labels
const loanPurposeLabels = {
  'purchase': 'Purchase',
  'refinance': 'Refinance',
  'cash_out_refinance': 'Cash-Out Refinance'
};

/**
 * Get display label for loan type
 */
export function getLoanTypeLabel(value) {
  return loanTypeLabels[value] || value;
}

/**
 * Get display label for status
 */
export function getStatusLabel(value) {
  return statusLabels[value] || value;
}

/**
 * Get color classes for status badge
 */
export function getStatusColor(value) {
  return statusColors[value] || 'bg-slate-100 text-slate-800';
}

/**
 * Get display label for property type
 */
export function getPropertyTypeLabel(value) {
  return propertyTypeLabels[value] || value;
}

/**
 * Get display label for employment status
 */
export function getEmploymentStatusLabel(value) {
  return employmentStatusLabels[value] || value;
}

/**
 * Get display label for loan purpose
 */
export function getLoanPurposeLabel(value) {
  return loanPurposeLabels[value] || value;
}

/**
 * Format currency for display
 */
export function formatCurrency(value) {
  if (!value) return '-';
  return `$${parseFloat(value).toLocaleString()}`;
}

/**
 * Generic function to convert any enum value to title case
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}