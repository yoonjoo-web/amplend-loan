import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const REQUEST_ACTIVITY_TYPES = new Set([
  'document_requested',
  'document_request_followup',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      checklist_item_id,
      canceled_reason = 'linked_document_uploaded',
      canceled_at,
    } = await req.json();

    if (!checklist_item_id) {
      return Response.json({ error: 'checklist_item_id is required' }, { status: 400 });
    }

    const checklistItem = await base44.asServiceRole.entities.ChecklistItem.get(checklist_item_id);
    const activityHistory = Array.isArray(checklistItem?.activity_history)
      ? [...checklistItem.activity_history]
      : [];

    let updated = false;
    let canceledEntry = null;

    for (let index = activityHistory.length - 1; index >= 0; index -= 1) {
      const entry = activityHistory[index];
      if (!REQUEST_ACTIVITY_TYPES.has(entry?.type)) {
        continue;
      }

      if (!entry?.scheduled_email_id || entry?.canceled_at) {
        continue;
      }

      await base44.functions.invoke('emailService', {
        cancel_message_id: entry.scheduled_email_id,
      });

      const nextEntry = {
        ...entry,
        canceled_at: canceled_at || new Date().toISOString(),
        canceled_reason,
      };

      activityHistory[index] = nextEntry;
      updated = true;
      canceledEntry = nextEntry;
      break;
    }

    if (!updated) {
      return Response.json({
        success: true,
        skipped: true,
        reason: 'no_pending_scheduled_email',
      });
    }

    await base44.asServiceRole.entities.ChecklistItem.update(checklist_item_id, {
      activity_history: activityHistory,
    });

    return Response.json({
      success: true,
      canceled_entry: canceledEntry,
    });
  } catch (error) {
    console.error('[cancelDocumentRequestFollowup] Fatal error:', error);
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
});
