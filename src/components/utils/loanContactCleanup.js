import { base44 } from '@/api/base44Client';
import { LOAN_PARTNER_ROLES } from '@/components/utils/appRoles';

const CLEANUP_KEY = 'loan_contact_cleanup_v1';
const allowedKeys = new Set(
  LOAN_PARTNER_ROLES.map((role) => role.toLowerCase().replace(/\s+/g, '_'))
);

export const runLoanContactCleanup = async ({ toast } = {}) => {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(CLEANUP_KEY) === 'done') return;

  localStorage.setItem(CLEANUP_KEY, 'in_progress');

  try {
    const loans = await base44.entities.Loan.list();
    if (!loans || loans.length === 0) {
      localStorage.setItem(CLEANUP_KEY, 'done');
      return;
    }

    let updatedCount = 0;

    await Promise.all(
      loans.map(async (loan) => {
        const contacts = loan.loan_contacts || {};
        const nextContacts = {};
        let changed = false;

        Object.keys(contacts).forEach((key) => {
          if (allowedKeys.has(key)) {
            nextContacts[key] = contacts[key];
          } else {
            changed = true;
          }
        });

        if (changed) {
          await base44.entities.Loan.update(loan.id, { loan_contacts: nextContacts });
          updatedCount += 1;
        }
      })
    );

    if (toast) {
      toast({
        title: 'Loan contacts cleaned',
        description: `Updated ${updatedCount} loans to remove deprecated loan contact types.`
      });
    }

    localStorage.setItem(CLEANUP_KEY, 'done');
  } catch (error) {
    console.error('Loan contact cleanup failed:', error);
    localStorage.removeItem(CLEANUP_KEY);
    if (toast) {
      toast({
        variant: 'destructive',
        title: 'Loan contact cleanup failed',
        description: error.message || 'Unable to clean loan contacts.'
      });
    }
  }
};
