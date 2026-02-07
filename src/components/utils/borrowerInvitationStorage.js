const STORAGE_PREFIX = 'borrower_invite_status_';

export const getLocalBorrowerInvite = (borrowerId) => {
  if (!borrowerId) return null;
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${borrowerId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('[borrowerInvitationStorage] Failed to read local invite:', error);
    return null;
  }
};

export const setLocalBorrowerInvite = (borrowerId, inviteRecord) => {
  if (!borrowerId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${borrowerId}`, JSON.stringify(inviteRecord));
  } catch (error) {
    console.error('[borrowerInvitationStorage] Failed to write local invite:', error);
  }
};
