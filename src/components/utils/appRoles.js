export const APP_ROLES = [
  'Administrator',
  'Loan Officer',
  'Borrower',
  'Broker',
  'Liaison',
  'Referral Partner',
  'Title Company',
  'Insurance Company',
  'Servicer'
];

export const LOAN_PARTNER_ROLES = [
  'Broker',
  'Liaison',
  'Referral Partner',
  'Title Company',
  'Insurance Company',
  'Servicer'
];

const LEGACY_ROLE_MAP = new Map([
  ['administrator', 'Administrator'],
  ['loan officer', 'Loan Officer'],
  ['borrower', 'Borrower'],
  ['liaison', 'Liaison'],
  ['broker', 'Broker'],
  ['brokerage', 'Broker'],
  ['referrer', 'Referral Partner'],
  ['referral partner', 'Referral Partner'],
  ['title company', 'Title Company'],
  ['insurance provider', 'Insurance Company'],
  ['insurance company', 'Insurance Company'],
  ['servicer', 'Servicer'],
  ['auditor', 'Referral Partner'],
  ['appraisal firm', 'Referral Partner'],
  ['legal counsel', 'Referral Partner'],
  ['other', 'Referral Partner']
]);

export const normalizeAppRole = (value) => {
  if (!value) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  const mapped = LEGACY_ROLE_MAP.get(normalized.toLowerCase());
  return mapped || normalized;
};

export const isLoanPartnerRole = (value) => {
  const normalized = normalizeAppRole(value);
  return LOAN_PARTNER_ROLES.includes(normalized);
};
