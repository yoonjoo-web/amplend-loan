export const getBorrowerAccessIds = async (base44, user) => {
  if (!user) return [];

  let borrowerId = null;
  try {
    const borrowersByUserId = await base44.entities.Borrower.filter({ user_id: user.id });
    if (borrowersByUserId && borrowersByUserId.length > 0) {
      borrowerId = borrowersByUserId[0].id;
    } else if (user.email) {
      const borrowersByEmail = await base44.entities.Borrower.filter({ email: user.email });
      if (borrowersByEmail && borrowersByEmail.length > 0) {
        borrowerId = borrowersByEmail[0].id;
      }
    }
  } catch (error) {
    console.error('Error resolving borrower access ids:', error);
  }

  return Array.from(new Set([user.id, borrowerId].filter(Boolean)));
};
