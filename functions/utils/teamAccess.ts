export const isUserOnApplicationTeam = (
  application: Record<string, unknown>,
  user: { id?: string; email?: string }
) => {
  if (!application || !user) return false;
  const userId = user.id;
  if (!userId) return false;

  const referrerIds = Array.isArray(application.referrer_ids)
    ? (application.referrer_ids as string[])
    : [];
  const liaisonIds = Array.isArray(application.liaison_ids)
    ? (application.liaison_ids as string[])
    : [];
  const brokerIds = Array.isArray(application.broker_ids)
    ? (application.broker_ids as string[])
    : [];

  if (referrerIds.includes(userId)) return true;
  if (liaisonIds.includes(userId)) return true;
  if (brokerIds.includes(userId)) return true;

  const matchesContact = (contact?: Record<string, unknown>) => {
    if (!contact || typeof contact !== 'object') return false;
    const contactUserId = (contact as { user_id?: string }).user_id;
    const contactId = (contact as { id?: string }).id;
    const contactEmail = (contact as { email?: string }).email;
    if (contactUserId && contactUserId === userId) return true;
    if (contactId && contactId === userId) return true;
    if (contactEmail && user.email) {
      return contactEmail.toLowerCase() === user.email.toLowerCase();
    }
    return false;
  };

  return (
    matchesContact(application.referral_broker as Record<string, unknown>) ||
    matchesContact(
      (application.loan_contacts as Record<string, unknown>)?.broker as Record<string, unknown>
    )
  );
};
