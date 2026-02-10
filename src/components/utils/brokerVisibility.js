export const normalizePartnerType = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

export const isBrokerPartner = (partner) => {
  return normalizePartnerType(partner?.type) === 'broker';
};

export const hasBrokerPartnerIds = (partnerIds, loanPartners = []) => {
  if (!Array.isArray(partnerIds) || partnerIds.length === 0) return false;
  if (!Array.isArray(loanPartners) || loanPartners.length === 0) return false;

  const byId = new Map(loanPartners.filter(Boolean).map((partner) => [partner.id, partner]));
  return partnerIds.some((id) => {
    const partner = byId.get(id);
    return partner && isBrokerPartner(partner);
  });
};

export const hasBrokerPartnerName = (partnerName, loanPartners = []) => {
  if (!partnerName || !Array.isArray(loanPartners) || loanPartners.length === 0) return false;
  const normalizedName = String(partnerName).trim().toLowerCase();
  if (!normalizedName) return false;

  return loanPartners.some((partner) => {
    if (!partner?.name) return false;
    return partner.name.trim().toLowerCase() === normalizedName && isBrokerPartner(partner);
  });
};

export const hasBrokerContact = (contact) => {
  if (!contact || typeof contact !== 'object') return false;
  return Object.values(contact).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
};

export const hasBrokerOnLoan = (loan, loanPartners = []) => {
  return (
    hasBrokerPartnerIds(loan?.referrer_ids, loanPartners) ||
    hasBrokerPartnerName(loan?.referrer_name, loanPartners) ||
    hasBrokerContact(loan?.loan_contacts?.referral_broker)
  );
};

export const hasBrokerOnApplication = (application, loanPartners = []) => {
  return (
    hasBrokerPartnerIds(application?.referrer_ids, loanPartners) ||
    hasBrokerPartnerName(application?.referrer_name, loanPartners) ||
    hasBrokerContact(application?.referral_broker) ||
    hasBrokerContact(application?.loan_contacts?.referral_broker)
  );
};
