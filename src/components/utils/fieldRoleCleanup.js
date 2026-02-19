import { base44 } from '@/api/base44Client';

const CLEANUP_KEY = 'field_role_cleanup_v1';
const ROLE_TO_REMOVE = 'Guarantor';
const CONTEXTS = ['loan', 'application'];

export const runFieldRoleCleanup = async ({ toast } = {}) => {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(CLEANUP_KEY) === 'done') return;

  localStorage.setItem(CLEANUP_KEY, 'in_progress');

  try {
    let updatedCount = 0;

    for (const context of CONTEXTS) {
      const configs = await base44.entities.FieldConfiguration.filter({ context });
      if (!configs || configs.length === 0) continue;

      await Promise.all(
        configs.map(async (config) => {
          if (!Array.isArray(config.visible_to_roles)) return;
          if (!config.visible_to_roles.includes(ROLE_TO_REMOVE)) return;
          const nextRoles = config.visible_to_roles.filter((role) => role !== ROLE_TO_REMOVE);
          await base44.entities.FieldConfiguration.update(config.id, {
            visible_to_roles: nextRoles
          });
          updatedCount += 1;
        })
      );
    }

    if (toast) {
      toast({
        title: 'Field roles updated',
        description: `Removed ${ROLE_TO_REMOVE} from ${updatedCount} field configurations.`
      });
    }

    localStorage.setItem(CLEANUP_KEY, 'done');
  } catch (error) {
    console.error('Field role cleanup failed:', error);
    localStorage.removeItem(CLEANUP_KEY);
    if (toast) {
      toast({
        variant: 'destructive',
        title: 'Field role cleanup failed',
        description: error.message || 'Unable to update field roles.'
      });
    }
  }
};
