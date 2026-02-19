import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';


Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { application_id, updates } = await req.json();

    if (!application_id || !updates) {
      return Response.json({ error: 'Application ID and updates are required' }, { status: 400 });
    }

    // Check if user has elevated privileges
    const canManage = user.role === 'admin' || 
                      user.app_role === 'Administrator' || 
                      user.app_role === 'Loan Officer';

    if (!canManage) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch the application first to get current status
    const application = await base44.asServiceRole.entities.LoanApplication.get(application_id);
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    const oldStatus = application.status;
    const newStatus = updates.status;

    // Use service role to update
    const updatedApplication = await base44.asServiceRole.entities.LoanApplication.update(
      application_id, 
      updates
    );

    // Create notification if status changed
    if (newStatus && oldStatus !== newStatus) {
      const borrowerName = `${application.borrower_first_name} ${application.borrower_last_name}`;
      const statusMessages = {
        'under_review': {
          subject: 'Your Application is Under Review',
          title: 'Application Under Review',
          message: 'Your loan application is now under review by our team.',
          description: 'We are carefully reviewing all the information you provided. We\'ll notify you once the review is complete.'
        },
        'review_completed': {
          subject: 'Application Review Complete - Action Required',
          title: 'Review Completed',
          message: 'The review of your application has been completed.',
          description: 'Please review any comments from our team and resubmit if needed. Check your application dashboard for details.'
        },
        'approved': {
          subject: 'Congratulations! Your Application is Approved',
          title: 'Application Approved',
          message: 'Congratulations! Your loan application has been approved.',
          description: 'We\'re excited to move forward with your loan. Our team will be in touch shortly with the next steps.'
        },
        'rejected': {
          subject: 'Application Status Update',
          title: 'Application Status Updated',
          message: 'Your loan application status has been updated.',
          description: 'Please review the details in your application dashboard or contact your loan officer for more information.'
        }
      };

      const statusInfo = statusMessages[newStatus] || {
        subject: 'Application Status Update',
        title: 'Status Updated',
        message: `Your loan application status has been updated to ${newStatus.replace(/_/g, ' ')}`,
        description: 'Check your dashboard for more details.'
      };
      
      // Notify borrower
      const notificationUserIds = [application.primary_borrower_id].filter(Boolean);
      
      // Add co-borrowers
      if (application.co_borrowers && Array.isArray(application.co_borrowers)) {
        application.co_borrowers.forEach(cb => {
          if (cb.user_id) notificationUserIds.push(cb.user_id);
        });
      }

      if (notificationUserIds.length > 0) {
        try {
          // Send in-app notification
          await base44.functions.invoke('createNotification', {
            user_ids: notificationUserIds,
            message: `${statusInfo.message} (Application #${application.application_number})`,
            type: 'status_change',
            entity_type: 'LoanApplication',
            entity_id: application_id,
            link_url: `/NewApplication?id=${application_id}&action=view`,
            priority: newStatus === 'rejected' ? 'high' : 'normal'
          });
        } catch (notifError) {
          console.error('[updateApplicationStatus] Notification error:', notifError);
          // Continue even if in-app notification fails
        }

        try {
          // Send enhanced email notification via Resend
          for (const userId of notificationUserIds) {
            const recipient = await base44.asServiceRole.entities.User.get(userId);
            if (recipient && recipient.email) {
              const appUrl = 'https://loan-portal.amplend.net';
              const viewUrl = `${appUrl}/NewApplication?id=${application_id}&action=view`;
              
              await base44.functions.invoke('emailService', {
                email_type: 'application_status_update',
                recipient_email: recipient.email,
                recipient_name: `${recipient.first_name} ${recipient.last_name}`,
                data: {
                  status_subject: statusInfo.subject,
                  status_title: statusInfo.title,
                  status_message: statusInfo.message,
                  status_description: statusInfo.description,
                  application_number: application.application_number,
                  borrower_name: borrowerName,
                  status: newStatus,
                  application_id: application_id
                }
              });
            }
          }
        } catch (emailError) {
          console.error('[updateApplicationStatus] Email error:', emailError);
          // Continue even if email fails
        }
      }
    }

    return Response.json({ application: updatedApplication });

  } catch (error) {
    console.error('Error updating application:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
