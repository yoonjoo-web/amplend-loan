export const isUserOnLoanTeam = (loan, user, access = {}) => {
  if (!loan || !user) return false;
  const userId = user.id;
  if (!userId) return false;
  const partnerIds = Array.isArray(access.loanPartnerAccessIds) ? access.loanPartnerAccessIds : [];

  const matchesIdList = (ids) => {
    if (!Array.isArray(ids)) return false;
    if (ids.includes(userId)) return true;
    return partnerIds.some((partnerId) => ids.includes(partnerId));
  };

  if (matchesIdList(loan.referrer_ids)) return true;
  if (matchesIdList(loan.liaison_ids)) return true;
  if (matchesIdList(loan.broker_ids)) return true;

  const contact = loan.loan_contacts?.broker;
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

  const matchesIdList = (ids) => {
    if (!Array.isArray(ids)) return false;
    if (ids.includes(userId)) return true;
    return partnerIds.some((partnerId) => ids.includes(partnerId));
  };

  if (matchesIdList(application.referrer_ids)) return true;
  if (matchesIdList(application.liaison_ids)) return true;
  if (matchesIdList(application.broker_ids)) return true;

  // Check broker_user_id (set when broker creates application)
  if (application.broker_user_id && application.broker_user_id === userId) return true;

  const matchesContact = (contact) => {
    if (!contact || typeof contact !== 'object') return false;
    if (contact.user_id && contact.user_id === userId) return true;
    if (contact.id && (contact.id === userId || partnerIds.includes(contact.id))) return true;
    if (contact.email && user.email) {
      return contact.email.toLowerCase() === user.email.toLowerCase();
    }
    return false;
  };

  return matchesContact(application.referral_broker) || matchesContact(application.loan_contacts?.broker);
};