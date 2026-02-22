export const getLoanPartnerAccessIds = async (base44, user) => {
  if (!user) return [];

  let partnerIds = [];
  try {
    const partnersByUserId = await base44.entities.LoanPartner.filter({ user_id: user.id });
    if (partnersByUserId && partnersByUserId.length > 0) {
      partnerIds = partnersByUserId.map((partner) => partner.id).filter(Boolean);
    } else if (user.email) {
      const partnersByEmail = await base44.entities.LoanPartner.filter({ email: user.email });
      if (partnersByEmail && partnersByEmail.length > 0) {
        partnerIds = partnersByEmail.map((partner) => partner.id).filter(Boolean);
      }
    }
  } catch (error) {
    console.error('Error resolving loan partner access ids:', error);
  }

  return Array.from(new Set(partnerIds.filter(Boolean)));
};
