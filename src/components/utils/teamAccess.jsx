export const isUserOnLoanTeam = (loan, user, access = {}) => {
  if (!loan || !user) return false;
  const userId = user.id;
  if (!userId) return false;
  const partnerIds = Array.isArray(access.loanPartnerAccessIds) ? access.loanPartnerAccessIds : [];

  const toIdArray = (singleValue, legacyList) => {
    if (singleValue) return [String(singleValue)];
    if (Array.isArray(legacyList)) return legacyList.map(String).filter(Boolean);
    return [];
  };

  const matchesIdList = (values) => {
    if (!Array.isArray(values)) return false;
    const ids = values.map(String);
    if (ids.includes(String(userId))) return true;
    return partnerIds.some((partnerId) => ids.includes(String(partnerId)));
  };

  if (matchesIdList(toIdArray(loan.referrer_id, loan.referrer_ids))) return true;
  if (matchesIdList(toIdArray(loan.liaison_id, loan.liaison_ids))) return true;
  if (matchesIdList(toIdArray(loan.broker_id, loan.broker_ids))) return true;

  const contact = loan.loan_partners?.broker;
  if (contact && typeof contact === 'object') {
    if (contact.user_id && contact.user_id === userId) return true;
    if (contact.id && (contact.id === userId || partnerIds.includes(contact.id))) return true;
    if (contact.email && user.email) {
      return contact.email.toLowerCase() === user.email.toLowerCase();
    }
  }

  return false;
};

export const isUserOnApplicationTeam = (application, user, access = {}) => {
  if (!application || !user) return false;
  const userId = user.id;
  if (!userId) return false;
  const createdById = typeof application.created_by === 'object'
    ? application.created_by?.id
    : application.created_by;
  if (createdById && createdById === userId) return true;
  const partnerIds = Array.isArray(access.loanPartnerAccessIds) ? access.loanPartnerAccessIds : [];

  const toIdArray = (singleValue, legacyList) => {
    if (singleValue) return [String(singleValue)];
    if (Array.isArray(legacyList)) return legacyList.map(String).filter(Boolean);
    return [];
  };

  const matchesIdList = (values) => {
    if (!Array.isArray(values)) return false;
    const ids = values.map(String);
    if (ids.includes(String(userId))) return true;
    return partnerIds.some((partnerId) => ids.includes(String(partnerId)));
  };

  if (matchesIdList(toIdArray(application.referrer_id, application.referrer_ids))) return true;
  if (matchesIdList(toIdArray(application.liaison_id, application.liaison_ids))) return true;
  if (matchesIdList(toIdArray(application.broker_id, application.broker_ids))) return true;
  if ((application.broker_id || application.broker_user_id) && (application.broker_id || application.broker_user_id) === userId) return true;

  const matchesContact = (contact) => {
    if (!contact || typeof contact !== 'object') return false;
    if (contact.user_id && contact.user_id === userId) return true;
    if (contact.id && (contact.id === userId || partnerIds.includes(contact.id))) return true;
    if (contact.email && user.email) {
      return contact.email.toLowerCase() === user.email.toLowerCase();
    }
    return false;
  };

  return matchesContact(application.referral_broker) || matchesContact(application.loan_partners?.broker);
};
