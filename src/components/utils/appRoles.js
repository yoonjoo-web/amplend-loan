export const APP_ROLES = [
  'Administrator',
  'Loan Officer',
  'Borrower',
  'Broker',
  'Liaison',
  'Referral Partner'
];

export const LOAN_PARTNER_ROLES = [
  'Broker',
  'Liaison',
  'Referral Partner'
];

export const normalizeAppRole = (value) => {
  if (!value) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  return normalized;
};

export const isLoanPartnerRole = (value) => {
  const normalized = normalizeAppRole(value);
  return LOAN_PARTNER_ROLES.includes(normalized);
};
