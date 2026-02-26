export const normalizePartnerType = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

export const isBrokerPartner = (partner) => {
  const role = normalizePartnerType(partner?.app_role || partner?.type);
  return role === 'broker';
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

export const wasInvitedByBroker = (source) => {
  if (!source || typeof source !== 'object') return false;
  const role = normalizePartnerType(
    source.invited_by_role ||
    source.inviter_role ||
    source.invited_by_app_role
  );
  return role === 'broker';
};

export const hasBrokerOnLoan = (loan, loanPartners = []) => {
  return (
    Boolean(loan?.broker_id) ||
    hasBrokerPartnerIds(loan?.referrer_ids, loanPartners) ||
    hasBrokerPartnerName(loan?.referrer_name, loanPartners) ||
    hasBrokerContact(loan?.loan_contacts?.broker)
  );
};

export const hasBrokerOnApplication = (application, loanPartners = []) => {
  return (
    Boolean(application?.broker_id) ||
    hasBrokerPartnerIds(application?.referrer_ids, loanPartners) ||
    hasBrokerPartnerName(application?.referrer_name, loanPartners) ||
    hasBrokerContact(application?.referral_broker) ||
    hasBrokerContact(application?.loan_contacts?.broker)
  );
};
