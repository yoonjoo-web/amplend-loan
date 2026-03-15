import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const REQUEST_ACTIVITY_TYPE = 'document_requested';
const FOLLOWUP_ACTIVITY_TYPE = 'document_request_followup';
const REQUEST_CADENCE_DAYS = 2;
const APP_URL = 'https://loan-portal.amplend.net';

const asIsoString = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const addDaysIso = (value: string, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const getActivityEntries = (activityHistory: any[], type: string) =>
  [...(Array.isArray(activityHistory) ? activityHistory : [])]
    .filter(
      (entry) =>
        entry?.type === type || entry?.action === type || entry?.activity_type === type
    )
    .sort(
      (a, b) =>
        new Date(a?.timestamp || 0).getTime() - new Date(b?.timestamp || 0).getTime()
    );

const getCurrentScheduledEntryIndex = (activityHistory: any[]) => {
  for (let index = activityHistory.length - 1; index >= 0; index -= 1) {
    const entry = activityHistory[index];
    if (
      (entry?.type === REQUEST_ACTIVITY_TYPE || entry?.type === FOLLOWUP_ACTIVITY_TYPE) &&
      entry?.scheduled_email_id &&
      !entry?.canceled_at
    ) {
      return index;
    }
  }

  return -1;
};

const resolveRecipient = async (base44: any, rawRecipientId: string) => {
  const recipientId = String(rawRecipientId);

  try {
    const user = await base44.asServiceRole.entities.User.get(recipientId);
    if (user) {
      return {
        userId: String(user.id),
        email: user.email || null,
        name:
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          user.full_name ||
          user.email ||
          null,
      };
    }
  } catch (_error) {
    // Fall through to borrower and loan partner lookups.
  }

  try {
    const borrower = await base44.asServiceRole.entities.Borrower.get(recipientId);
    if (borrower?.user_id) {
      const user = await base44.asServiceRole.entities.User.get(String(borrower.user_id));
      return {
        userId: String(user.id),
        email: user.email || borrower.email || null,
        name:
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          borrower.name ||
          borrower.email ||
          null,
      };
    }
  } catch (_error) {
    // Fall through to loan partner lookup.
  }

  try {
    const partner = await base44.asServiceRole.entities.LoanPartner.get(recipientId);
    if (partner?.user_id) {
      const user = await base44.asServiceRole.entities.User.get(String(partner.user_id));
      return {
        userId: String(user.id),
        email: user.email || partner.email || null,
        name:
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          partner.name ||
          partner.email ||
          null,
      };
    }
  } catch (_error) {
    // No-op.
  }

  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      loan_id,
      checklist_item_id,
      document_title,
      recipient_user_id,
      desired_due_at,
      recipient_name,
      mode,
      actor_user_id,
      actor_user_name,
      link_url,
    } = await req.json();

    if (!loan_id || !checklist_item_id || !document_title || !recipient_user_id || !mode) {
      return Response.json(
        {
          error:
            'loan_id, checklist_item_id, document_title, recipient_user_id, and mode are required',
        },
        { status: 400 }
      );
    }

    if (!['request', 'followup'].includes(mode)) {
      return Response.json({ error: 'mode must be request or followup' }, { status: 400 });
    }

    const checklistItem = await base44.asServiceRole.entities.ChecklistItem.get(checklist_item_id);
    const activityHistory = Array.isArray(checklistItem?.activity_history)
      ? [...checklistItem.activity_history]
      : [];
    const requestEntries = getActivityEntries(activityHistory, REQUEST_ACTIVITY_TYPE);
    const latestRequest = requestEntries[requestEntries.length - 1] || null;
    const requestCycleStart = asIsoString(latestRequest?.timestamp) || new Date().toISOString();

    if (mode === 'followup') {
      const linkedDocuments = await base44.asServiceRole.entities.LoanDocument.filter({
        loan_id,
        checklist_item_id,
      });

      const hasUploadedLinkedDocument = linkedDocuments.some((document: any) => {
        const uploadedAt = asIsoString(
          document?.uploaded_date || document?.updated_date || document?.created_date
        );
        return uploadedAt && uploadedAt > requestCycleStart;
      });

      if (hasUploadedLinkedDocument) {
        return Response.json({
          success: true,
          skipped: true,
          reason: 'linked_document_uploaded',
        });
      }
    }

    const resolvedRecipient = await resolveRecipient(base44, String(recipient_user_id));
    if (!resolvedRecipient?.userId) {
      return Response.json(
        { error: 'Recipient is not linked to an active portal user.' },
        { status: 400 }
      );
    }

    const effectiveRecipientName =
      recipient_name || resolvedRecipient.name || 'Recipient';
    const effectiveActorName = actor_user_name || user.full_name || user.email || 'Amplend';
    const fullLinkUrl = link_url
      ? link_url.startsWith('http')
        ? link_url
        : `${APP_URL}${link_url}`
      : `${APP_URL}/LoanDetail?id=${loan_id}&tab=documents`;

    const message =
      mode === 'followup'
        ? `${effectiveActorName} sent a reminder for ${document_title}.`
        : `${effectiveActorName} requested ${document_title}.`;

    const desiredDueAt =
      asIsoString(desired_due_at) ||
      latestRequest?.desired_due_at ||
      asIsoString(checklistItem?.due_date) ||
      addDaysIso(requestCycleStart, REQUEST_CADENCE_DAYS);
    const followupScheduledAt =
      mode === 'request'
        ? desiredDueAt
        : addDaysIso(new Date().toISOString(), REQUEST_CADENCE_DAYS);
    const priorScheduledEntryIndex = getCurrentScheduledEntryIndex(activityHistory);
    const priorScheduledEntry =
      priorScheduledEntryIndex >= 0 ? activityHistory[priorScheduledEntryIndex] : null;

    const notification = await base44.asServiceRole.entities.Notification.create({
      user_id: resolvedRecipient.userId,
      message,
      type: mode === 'followup' ? 'document_request_followup' : 'document_request',
      entity_type: 'ChecklistItem',
      entity_id: checklist_item_id,
      link_url: link_url || `/LoanDetail?id=${loan_id}&tab=documents`,
      priority: 'medium',
      read: false,
    });

    if (resolvedRecipient.email) {
      await base44.functions.invoke('emailService', {
        email_type: 'generic_notification',
        recipient_email: resolvedRecipient.email,
        recipient_name: effectiveRecipientName,
        data: {
          subject:
            mode === 'followup'
              ? `Reminder: ${document_title}`
              : `Document requested: ${document_title}`,
          title: mode === 'followup' ? 'Document Reminder' : 'Document Request',
          message,
          notification_type:
            mode === 'followup' ? 'document_request_followup' : 'document_request',
          cta_text: 'View Loan Documents',
          cta_url: fullLinkUrl,
        },
      });
    }

    if (mode === 'followup' && priorScheduledEntry?.scheduled_email_id) {
      try {
        await base44.functions.invoke('emailService', {
          cancel_message_id: priorScheduledEntry.scheduled_email_id,
        });
      } catch (cancelError) {
        console.error(
          '[sendDocumentRequestNotification] Failed to cancel prior scheduled followup:',
          cancelError
        );
      }
    }

    const scheduledEmail = resolvedRecipient.email
      ? await base44.functions.invoke('emailService', {
          email_type: 'generic_notification',
          recipient_email: resolvedRecipient.email,
          recipient_name: effectiveRecipientName,
          scheduled_at: followupScheduledAt,
          data: {
            subject: `Reminder: ${document_title}`,
            title: 'Document Reminder',
            message: `Reminder: ${document_title} is still needed.`,
            notification_type: 'document_request_followup',
            cta_text: 'View Loan Documents',
            cta_url: fullLinkUrl,
          },
        })
      : null;

    const scheduledEmailId =
      scheduledEmail?.message_id ||
      scheduledEmail?.data?.message_id ||
      scheduledEmail?.details?.message_id ||
      scheduledEmail?.id ||
      null;

    if (mode === 'followup') {
      const followupTimestamp = new Date().toISOString();

      if (priorScheduledEntryIndex >= 0) {
        activityHistory[priorScheduledEntryIndex] = {
          ...activityHistory[priorScheduledEntryIndex],
          canceled_at: followupTimestamp,
          canceled_reason: 'replaced_by_new_schedule',
        };
      }

      activityHistory.push({
        type: FOLLOWUP_ACTIVITY_TYPE,
        timestamp: followupTimestamp,
        user_id: actor_user_id || user.id,
        user_name: effectiveActorName,
        label: `Followed up on ${document_title} with ${effectiveRecipientName}`,
        recipient_user_id: resolvedRecipient.userId,
        recipient_name: effectiveRecipientName,
        desired_due_at: desiredDueAt,
        cadence_days: REQUEST_CADENCE_DAYS,
        scheduled_email_id: scheduledEmailId,
        scheduled_for: followupScheduledAt,
        source: 'sendDocumentRequestNotification',
      });

      await base44.asServiceRole.entities.ChecklistItem.update(checklist_item_id, {
        activity_history: activityHistory,
      });
    }

    return Response.json({
      success: true,
      notification,
      recipient_user_id: resolvedRecipient.userId,
      scheduled_followup_email_id: scheduledEmailId,
      scheduled_followup_at: followupScheduledAt,
    });
  } catch (error) {
    console.error('[sendDocumentRequestNotification] Fatal error:', error);
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
});
