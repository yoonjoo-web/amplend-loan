export const isUserOnApplicationTeam = (
  application: Record<string, unknown>,
  user: { id?: string; email?: string; partnerIds?: string[] }
) => {
  if (!application || !user) return false;
  const userId = user.id;
  if (!userId) return false;
  const partnerIds = Array.isArray(user.partnerIds) ? user.partnerIds : [];

  const asIdArray = (singleValue: unknown, legacyList: unknown): string[] => {
    if (singleValue) return [String(singleValue)];
    if (Array.isArray(legacyList)) return legacyList.map(String).filter(Boolean);
    return [];
  };
  const referrerIds = asIdArray(application.referrer_id, application.referrer_ids);
  const liaisonIds = asIdArray(application.liaison_id, application.liaison_ids);
  const brokerIds = asIdArray(application.broker_id, application.broker_ids);

  if (referrerIds.includes(userId) || partnerIds.some((id) => referrerIds.includes(id))) return true;
  if (liaisonIds.includes(userId) || partnerIds.some((id) => liaisonIds.includes(id))) return true;
  if (brokerIds.includes(userId) || partnerIds.some((id) => brokerIds.includes(id))) return true;
  const brokerOwnerId = (application.broker_id || application.broker_user_id) as string | undefined;
  if (brokerOwnerId && brokerOwnerId === userId) return true;

  const matchesContact = (contact?: Record<string, unknown>) => {
    if (!contact || typeof contact !== 'object') return false;
    const contactUserId = (contact as { user_id?: string }).user_id;
    const contactId = (contact as { id?: string }).id;
    const contactEmail = (contact as { email?: string }).email;
    if (contactUserId && contactUserId === userId) return true;
    if (contactId && (contactId === userId || partnerIds.includes(contactId))) return true;
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
