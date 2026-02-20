export const isUserOnLoanTeam = (loan, user) => {
  if (!loan || !user) return false;
  const userId = user.id;
  if (!userId) return false;

  if (Array.isArray(loan.referrer_ids) && loan.referrer_ids.includes(userId)) return true;
  if (Array.isArray(loan.liaison_ids) && loan.liaison_ids.includes(userId)) return true;
  if (Array.isArray(loan.broker_ids) && loan.broker_ids.includes(userId)) return true;

  const contact = loan.loan_contacts?.broker;
  if (contact && typeof contact === 'object') {
    if (contact.user_id && contact.user_id === userId) return true;
    if (contact.id && contact.id === userId) return true;
    if (contact.email && user.email) {
      return contact.email.toLowerCase() === user.email.toLowerCase();
    }
  }

  return false;
};

export const isUserOnApplicationTeam = (application, user) => {
  if (!application || !user) return false;
  const userId = user.id;
  if (!userId) return false;

  if (Array.isArray(application.referrer_ids) && application.referrer_ids.includes(userId)) return true;
  if (Array.isArray(application.liaison_ids) && application.liaison_ids.includes(userId)) return true;
  if (Array.isArray(application.broker_ids) && application.broker_ids.includes(userId)) return true;

  const matchesContact = (contact) => {
    if (!contact || typeof contact !== 'object') return false;
    if (contact.user_id && contact.user_id === userId) return true;
    if (contact.id && contact.id === userId) return true;
    if (contact.email && user.email) {
      return contact.email.toLowerCase() === user.email.toLowerCase();
    }
    return false;
  };

  return matchesContact(application.referral_broker) || matchesContact(application.loan_contacts?.broker);
};
