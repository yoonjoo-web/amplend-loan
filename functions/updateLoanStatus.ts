import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loan_id, updates } = await req.json();

    if (!loan_id || !updates) {
      return Response.json({ error: 'Loan ID and updates are required' }, { status: 400 });
    }

    // Check if user has elevated privileges
    const canManage = user.role === 'admin' || 
                      user.app_role === 'Administrator' || 
                      user.app_role === 'Loan Officer';

    if (!canManage) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch the loan first to get current status
    const loan = await base44.asServiceRole.entities.Loan.get(loan_id);
    
    if (!loan) {
      return Response.json({ error: 'Loan not found' }, { status: 404 });
    }

    const oldStatus = loan.status;
    const newStatus = updates.status;

    // Add modification history
    const userName = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.full_name || user.email;

    const changedFields = [];
    Object.keys(updates).forEach(key => {
      if (JSON.stringify(loan[key]) !== JSON.stringify(updates[key])) {
        changedFields.push(key);
      }
    });

    const modificationHistory = loan.modification_history || [];
    modificationHistory.push({
      timestamp: new Date().toISOString(),
      modified_by: user.id,
      modified_by_name: userName,
      description: `Updated ${changedFields.length} field(s): ${changedFields.join(', ')}`,
      fields_changed: changedFields
    });

    // Use service role to update
    const updatedLoan = await base44.asServiceRole.entities.Loan.update(
      loan_id, 
      {
        ...updates,
        modification_history: modificationHistory
      }
    );

    // Create notification if status changed
    if (newStatus && oldStatus !== newStatus) {
      const statusMessages = {
        'application_submitted': {
          subject: 'Loan Application Submitted',
          title: 'Application Submitted',
          message: 'Your loan application has been submitted and the official loan process has begun.',
          description: 'Our team will begin reviewing your application shortly.'
        },
        'underwriting': {
          subject: 'Loan Status: Underwriting',
          title: 'Underwriting in Progress',
          message: 'Your loan is now in underwriting.',
          description: 'We are evaluating your financial information, credit history, and other relevant factors.'
        },
        'processing': {
          subject: 'Loan Status: Processing',
          title: 'Processing Documents',
          message: 'Your loan is now in processing.',
          description: 'We are reviewing all delivered documents for completeness and accuracy.'
        },
        'on_hold': {
          subject: 'Loan Status: On Hold',
          title: 'Loan On Hold',
          message: 'Your loan has been placed on hold.',
          description: 'Please contact your loan officer for more information.'
        },
        'term_sheet_sent': {
          subject: 'Term Sheet Sent',
          title: 'Term Sheet Available',
          message: 'Your post-appraisal term sheet has been sent.',
          description: 'Please review the term sheet and appraisal report carefully.'
        },
        'conditional_approval': {
          subject: 'Conditional Approval',
          title: 'Conditionally Approved',
          message: 'Congratulations! Your loan has received conditional approval.',
          description: 'Please satisfy the specified conditions to proceed to final approval.'
        },
        'final_approval': {
          subject: 'Final Approval',
          title: 'Loan Approved',
          message: 'Excellent news! Your loan has received final approval.',
          description: 'We are now preparing for closing. Your loan officer will contact you with next steps.'
        },
        'clear_to_close': {
          subject: 'Clear to Close',
          title: 'Clear to Close',
          message: 'Your loan is clear to close!',
          description: 'All conditions have been met and we are ready to schedule your closing.'
        },
        'closing_scheduled': {
          subject: 'Closing Scheduled',
          title: 'Closing Date Set',
          message: 'Your loan closing has been scheduled.',
          description: 'Please check your loan details for the closing date, time, and location.'
        },
        'loan_funded': {
          subject: 'Loan Funded',
          title: 'Loan Successfully Funded',
          message: 'Congratulations! Your loan has been funded.',
          description: 'The approved loan amount has been disbursed.'
        },
        'loan_sold': {
          subject: 'Loan Status Update',
          title: 'Loan Sold',
          message: 'Your loan has been sold in the secondary market.',
          description: 'This is a routine transaction and does not affect your loan terms. You may receive information about your new servicer soon.'
        },
        'in_house_servicing': {
          subject: 'Loan Servicing Update',
          title: 'In-House Servicing',
          message: 'Your loan is being serviced in-house.',
          description: 'We will continue to manage your loan account and process your payments.'
        },
        'draws_underway': {
          subject: 'Loan Status: Draws Underway',
          title: 'Draws in Progress',
          message: 'Your project draws are now underway.',
          description: 'Funds will be released according to the draw schedule as work progresses.'
        },
        'draws_fully_released': {
          subject: 'All Draws Released',
          title: 'Draws Fully Released',
          message: 'All draw funds have been fully released.',
          description: 'Your financed budget amount has been completely drawn.'
        },
        'archived': {
          subject: 'Loan Closed',
          title: 'Loan Archived',
          message: 'Your loan has been paid off and closed.',
          description: 'Thank you for your business. We hope to work with you again in the future.'
        },
        'dead': {
          subject: 'Loan Dead',
          title: 'Loan Marked as Dead',
          message: 'This loan is permanently closed.',
          description: 'No further actions or updates can be made to this loan. Thank you for your business. We hope to work with you again in the future.'
        }
      };

      const statusInfo = statusMessages[newStatus] || {
        subject: 'Loan Status Update',
        title: 'Status Updated',
        message: `Your loan status has been updated to ${newStatus.replace(/_/g, ' ')}`,
        description: 'Check your loan dashboard for more details.'
      };
      
      // Notify all parties involved with the loan
      const notificationUserIds = [];
      
      // Add borrowers
      if (loan.borrower_ids && Array.isArray(loan.borrower_ids)) {
        notificationUserIds.push(...loan.borrower_ids);
      }
      
      // Add guarantors
      if (loan.guarantor_ids && Array.isArray(loan.guarantor_ids)) {
        notificationUserIds.push(...loan.guarantor_ids);
      }
      
      // Add referrers
      if (loan.referrer_ids && Array.isArray(loan.referrer_ids)) {
        notificationUserIds.push(...loan.referrer_ids);
      }

      const uniqueUserIds = [...new Set(notificationUserIds)].filter(Boolean);

      if (uniqueUserIds.length > 0) {
        try {
          // Send in-app notification
          await base44.functions.invoke('createNotification', {
            user_ids: uniqueUserIds,
            message: `${statusInfo.message} (Loan ${loan.loan_number || loan.primary_loan_id || '#' + loan_id})`,
            type: 'status_change',
            entity_type: 'Loan',
            entity_id: loan_id,
            link_url: `/LoanDetail?id=${loan_id}`,
            priority: ['on_hold', 'archived'].includes(newStatus) ? 'high' : 'normal'
          });

          // Send enhanced email notification via Resend
          for (const userId of uniqueUserIds) { // Changed from notificationUserIds to uniqueUserIds to prevent duplicate emails
            const recipient = await base44.asServiceRole.entities.User.get(userId);
            if (recipient && recipient.email) {
              const appUrl = 'https://loan-portal.amplend.net'; // Hardcoded as per outline
              const viewUrl = `${appUrl}/LoanDetail?id=${loan_id}`;
              
              await base44.functions.invoke('emailService', {
                email_type: 'loan_status_update',
                recipient_email: recipient.email,
                recipient_name: `${recipient.first_name} ${recipient.last_name}`,
                data: {
                  status_subject: statusInfo.subject,
                  status_title: statusInfo.title,
                  status_message: statusInfo.message,
                  status_description: statusInfo.description,
                  loan_number: loan.loan_number,
                  property_address: loan.property_address,
                  status: newStatus,
                  loan_id: loan_id
                }
              });
            }
          }
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
          // Continue even if notification fails
        }
      }
    }

    return Response.json({ success: true, loan: updatedLoan });

  } catch (error) {
    console.error('Error updating loan:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});