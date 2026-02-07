let cachedFieldsPromise = null;

const DATE_FIELD_CANDIDATES = [
  'invitation_sent_date',
  'invitation_sent_at',
  'invited_date',
  'invited_at',
  'invitation_date',
  'invite_sent_date',
  'invite_sent_at',
  'invite_date'
];

const STATUS_FIELD_CANDIDATES = [
  'invitation_status',
  'invite_status',
  'invited_status'
];

export const getBorrowerInvitationFields = async (base44) => {
  if (cachedFieldsPromise) {
    return cachedFieldsPromise;
  }

  cachedFieldsPromise = (async () => {
    try {
      const schema = await base44.entities.Borrower.schema();
      const keys = Object.keys(schema?.properties || {});

      const dateField = DATE_FIELD_CANDIDATES.find((key) => keys.includes(key)) || null;
      const statusField = STATUS_FIELD_CANDIDATES.find((key) => keys.includes(key)) || null;

      // If fields are missing, don't cache so later calls can re-check after schema updates.
      if (!dateField && !statusField) {
        cachedFieldsPromise = null;
      }

      return { dateField, statusField };
    } catch (error) {
      console.error('[borrowerInvitationFields] Failed to load borrower schema:', error);
      return { dateField: null, statusField: null };
    }
  })();

  return cachedFieldsPromise;
};
