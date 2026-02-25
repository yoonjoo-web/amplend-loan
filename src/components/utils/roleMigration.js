import { Borrower, Loan, LoanPartner, User } from '@/entities/all';
import { normalizeAppRole } from '@/components/utils/appRoles';

const MIGRATION_KEY = 'app_role_migration_v2';
const REMOVED_PARTNER_TYPES = new Set(['Auditor', 'Appraisal Firm', 'Legal Counsel', 'Other']);

const hasLegacyTypeNote = (notes, legacyType) => {
  if (!notes || !legacyType) return false;
  return String(notes).toLowerCase().includes(`legacy type: ${legacyType}`.toLowerCase());
};

export const runRoleMigration = async ({ toast } = {}) => {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_KEY) === 'done') return;

  localStorage.setItem(MIGRATION_KEY, 'in_progress');

  try {
    const [users, borrowers, partners, loans] = await Promise.all([
      User.list(),
      Borrower.list(),
      LoanPartner.list(),
      Loan.list()
    ]);

    const usersById = new Map((users || []).map((u) => [u.id, u]));
    const usersByEmail = new Map(
      (users || [])
        .filter((u) => u.email)
        .map((u) => [u.email.toLowerCase(), u])
    );

    let userUpdates = 0;
    let borrowerUpdates = 0;
    let partnerUpdates = 0;
    let loanUpdates = 0;

    // Normalize user app roles
    await Promise.all(
      (users || []).map(async (user) => {
        const normalizedRole = normalizeAppRole(user.app_role);
        if (normalizedRole && normalizedRole !== user.app_role) {
          await User.update(user.id, { app_role: normalizedRole });
          userUpdates += 1;
        }
      })
    );

    const liaisonBorrowers = (borrowers || []).filter((b) => {
      const linkedUser =
        (b.user_id && usersById.get(b.user_id)) ||
        (b.email && usersByEmail.get(b.email.toLowerCase()));
      return normalizeAppRole(linkedUser?.app_role) === 'Liaison';
    });
    const borrowerIdToUserId = new Map(
      (borrowers || [])
        .filter((b) => b.user_id)
        .map((b) => [b.id, b.user_id])
    );

    // Update borrowers and associated users
    await Promise.all(
      (borrowers || []).map(async (borrower) => {
        const linkedUser =
          (borrower.user_id && usersById.get(borrower.user_id)) ||
          (borrower.email && usersByEmail.get(borrower.email.toLowerCase()));

        if (linkedUser) {
          const normalizedRole = normalizeAppRole(linkedUser.app_role);
          if (!normalizedRole || normalizedRole === 'Borrower') {
            if (linkedUser.app_role !== 'Borrower') {
              await User.update(linkedUser.id, { app_role: 'Borrower' });
              userUpdates += 1;
            }
          }
        }
      })
    );

    // Update loan partners (type -> app_role)
    await Promise.all(
      (partners || []).map(async (partner) => {
        const normalizedRole = normalizeAppRole(partner.app_role || partner.type);
        const needsRoleUpdate = normalizedRole && normalizedRole !== partner.app_role;
        const needsTypeClear = partner.type != null;
        const needsNote =
          partner.type &&
          REMOVED_PARTNER_TYPES.has(partner.type) &&
          !hasLegacyTypeNote(partner.notes, partner.type);

        if (needsRoleUpdate || needsTypeClear || needsNote) {
          const nextNotes =
            needsNote
              ? `${partner.notes ? `${partner.notes}\n` : ''}Legacy type: ${partner.type}`
              : partner.notes;

          await LoanPartner.update(partner.id, {
            app_role: normalizedRole || partner.app_role || null,
            type: null,
            notes: nextNotes
          });
          partnerUpdates += 1;
        }
      })
    );

    // Migrate loan liaison ids from borrower ids when possible
    const liaisonBorrowerIds = new Set(
      liaisonBorrowers.flatMap((b) => [b.id, b.user_id].filter(Boolean))
    );

    await Promise.all(
      (loans || []).map(async (loan) => {
        const currentBorrowerIds = Array.isArray(loan.borrower_ids) ? loan.borrower_ids : [];
        const currentLiaisonIds = Array.isArray(loan.liaison_ids) ? loan.liaison_ids : [];

        let nextBorrowerIds = [];
        const nextLiaisonIds = new Set(currentLiaisonIds);

        currentBorrowerIds.forEach((id) => {
          if (liaisonBorrowerIds.has(id)) {
            const mappedUserId = borrowerIdToUserId.get(id) || id;
            nextLiaisonIds.add(mappedUserId);
            return;
          }
          nextBorrowerIds.push(id);
        });

        const normalizedLiaisonIds = Array.from(nextLiaisonIds).map((id) => borrowerIdToUserId.get(id) || id);
        const uniqueLiaisonIds = Array.from(new Set(normalizedLiaisonIds));

        const borrowerChanged = JSON.stringify(currentBorrowerIds) !== JSON.stringify(nextBorrowerIds);
        const liaisonChanged = JSON.stringify(currentLiaisonIds) !== JSON.stringify(uniqueLiaisonIds);

        if (borrowerChanged || liaisonChanged) {
          await Loan.update(loan.id, {
            borrower_ids: nextBorrowerIds,
            liaison_ids: uniqueLiaisonIds
          });
          loanUpdates += 1;
        }
      })
    );

    if (toast) {
      toast({
        title: 'Role migration completed',
        description: `Updated ${userUpdates} users, ${borrowerUpdates} borrowers, ${partnerUpdates} partners, ${loanUpdates} loans.`
      });
    }

    localStorage.setItem(MIGRATION_KEY, 'done');
  } catch (error) {
    console.error('Role migration failed:', error);
    localStorage.removeItem(MIGRATION_KEY);
    if (toast) {
      toast({
        variant: 'destructive',
        title: 'Role migration failed',
        description: error.message || 'Unable to migrate legacy roles. Please try again.'
      });
    }
  }
};
