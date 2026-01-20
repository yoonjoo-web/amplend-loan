import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      user_ids, 
      message, 
      type, 
      entity_type, 
      entity_id, 
      link_url,
      priority = 'normal',
      send_email = false
    } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return Response.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    if (!message || !type) {
      return Response.json({ error: 'message and type are required' }, { status: 400 });
    }

    // Create notifications for each user using service role
    const notifications = [];
    for (const userId of user_ids) {
      const notification = await base44.asServiceRole.entities.Notification.create({
        user_id: userId,
        message,
        type,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        link_url: link_url || null,
        priority,
        read: false
      });
      
      notifications.push(notification);
    }

    // Optionally send email notification
    if (send_email) {
      try {
        const appUrl = 'https://loan-portal.amplend.net';
                
        // Fetch user details for each recipient
        for (const userId of user_ids) {
          const recipient = await base44.asServiceRole.entities.User.get(userId);
          if (recipient && recipient.email) {
            const emailSubject = `Notification: ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
            
            // Ensure link_url is absolute
            const fullLinkUrl = link_url ? (link_url.startsWith('http') ? link_url : `${appUrl}${link_url}`) : null;
            
            await base44.functions.invoke('emailService', {
              email_type: 'generic_notification',
              recipient_email: recipient.email,
              recipient_name: `${recipient.first_name} ${recipient.last_name}`,
              data: {
                subject: emailSubject,
                title: 'New Notification',
                message: message,
                notification_type: type,
                cta_text: 'View Details',
                cta_url: fullLinkUrl
              }
            });
          }
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
        // Continue even if email fails
      }
    }

    return Response.json({ 
      success: true, 
      notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return Response.json({ 
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});