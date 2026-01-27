import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      email_type,
      recipient_email,
      recipient_name,
      data = {}
    } = body;


    if (!email_type || !recipient_email) {
      return Response.json({ 
        error: 'email_type and recipient_email are required' 
      }, { status: 400 });
    }

    const appUrl = 'https://loan-portal.amplend.net';
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68878b9144eaa44fb7e1d2be/3c1e957f2_AmplendLogowithTagline-White.png';

    // Email template configurations
    const emailTemplates = {
      'invite': {
        subject: `Welcome to Amplend, ${data.first_name || recipient_name}!`,
        title: 'Welcome to Amplend Loan Portal',
        subtitle: 'Manage your loans, documents, and status updates in one secure place.',
        greeting: `Hello ${recipient_name},`,
        message: 'You have been invited to set up your Amplend Loan Portal account. Once your account is created, you will be able to:',
        features: [
          'View key loan details and payment terms at a glance',
          'Upload and review required documents securely',
          'Stay informed with real-time status updates from your Amplend team'
        ],
        cta_text: 'Complete Your Account Setup',
        cta_url: `${appUrl}`,
        cta_note: 'Click the button above to sign in or create your account.'
      },
      'invite_borrower': {
        subject: `Welcome to Amplend, ${data.first_name}!`,
        title: 'Welcome to Amplend Loan Portal',
        subtitle: 'Manage your loans, documents, and status updates in one secure place.',
        greeting: `Hello ${data.first_name} ${data.last_name},`,
        message: 'You have been invited to set up your Amplend Loan Portal account. Once your account is created, you will be able to:',
        features: [
          'View key loan details and payment terms at a glance',
          'Upload and review required documents securely',
          'Stay informed with real-time status updates from your Amplend team'
        ],
        cta_text: 'Complete Your Account Setup',
        cta_url: data.application_number 
          ? `${appUrl}/NewApplication?id=${data.application_id || ''}&action=view`
          : `${appUrl}/Onboarding?app_role=Borrower&requested_first_name=${encodeURIComponent(data.first_name || '')}&requested_last_name=${encodeURIComponent(data.last_name || '')}`,
        cta_note: data.application_number 
          ? `You are being invited as ${data.role || 'Borrower'} for Application #${data.application_number}. Click the button above to sign in or create your account.`
          : 'Click the button above to sign in or create your account.'
      },
      'invite_co_borrower': {
        subject: `${data.inviter_name} Invited You to Join Their Loan Application`,
        title: 'Welcome to Amplend Loan Portal',
        subtitle: 'Manage your loans, documents, and status updates in one secure place.',
        greeting: `Hello ${data.first_name} ${data.last_name},`,
        message: `<strong>${data.inviter_name}</strong> has invited you to join loan application <strong>#${data.application_number}</strong> as a co-borrower. Create your account to review and complete your section of the application.`,
        features: null,
        cta_text: 'Complete Your Account Setup',
        cta_url: `${appUrl}/JoinRequest?type=co_borrower&application_id=${data.application_id}&inviter_id=${data.inviter_id}&app_role=Borrower&requested_first_name=${encodeURIComponent(data.first_name || '')}&requested_last_name=${encodeURIComponent(data.last_name || '')}`,
        cta_note: 'Click the button above to sign in or create your account.'
      },
      'invite_co_owner': {
        subject: `${data.inviter_name} Invited You to Join ${data.entity_name}`,
        title: 'Welcome to Amplend Loan Portal',
        subtitle: 'Manage your loans, documents, and status updates in one secure place.',
        greeting: `Hello ${data.first_name} ${data.last_name},`,
        message: `<strong>${data.inviter_name}</strong> has invited you to join <strong>${data.entity_name}</strong> as a co-owner.${data.existing_owners ? `<br><br><strong>Current Owners:</strong> ${data.existing_owners}` : ''}`,
        features: null,
        cta_text: 'Complete Your Account Setup',
        cta_url: `${appUrl}/JoinRequest?type=co_owner&entity_id=${data.entity_id}&inviter_id=${data.inviter_id}&app_role=Borrower&requested_first_name=${encodeURIComponent(data.first_name || '')}&requested_last_name=${encodeURIComponent(data.last_name || '')}`,
        cta_note: 'Click the button above to sign in or create your account.'
      },
      'invite_loan_partner': {
        subject: `You've Been Invited to Amplend as a ${data.partner_type}`,
        title: 'Welcome to Amplend Loan Portal',
        subtitle: 'Manage your loans, documents, and status updates in one secure place.',
        greeting: `Hello ${data.first_name} ${data.last_name},`,
        message: `You have been invited to join Amplend Loan Portal as a <strong>${data.partner_type}</strong>. Create your account to start collaborating on loan transactions.`,
        features: [
          'Access loan information relevant to your role',
          'Upload and manage required documents',
          'Communicate with the Amplend team and borrowers'
        ],
        cta_text: 'Complete Your Account Setup',
        cta_url: `${appUrl}/Onboarding?app_role=${encodeURIComponent(data.partner_type || 'Title Company')}&requested_first_name=${encodeURIComponent(data.first_name || '')}&requested_last_name=${encodeURIComponent(data.last_name || '')}`,
        cta_note: 'Click the button above to sign in or create your account.'
      },
      'invite_team_member': {
        subject: `You've Been Invited to Join the Amplend Team`,
        title: 'Welcome to Amplend Loan Portal',
        subtitle: 'Manage your loans, documents, and status updates in one secure place.',
        greeting: `Hello ${data.first_name} ${data.last_name},`,
        message: `You have been invited to join the Amplend team as a <strong>Loan Officer</strong>. Create your account to start managing loan applications and working with clients.`,
        features: [
          'Manage loan applications from submission to closing',
          'Review and approve borrower documents',
          'Communicate with borrowers and partners',
          'Track loan pipeline and performance'
        ],
        cta_text: 'Complete Your Account Setup',
        cta_url: `${appUrl}/Onboarding?app_role=Loan%20Officer&requested_first_name=${encodeURIComponent(data.first_name || '')}&requested_last_name=${encodeURIComponent(data.last_name || '')}`,
        cta_note: 'Click the button above to sign in or create your account.'
      },
      'request_co_borrower': {
        subject: `${data.inviter_name} Wants You to Join Their Loan Application`,
        title: 'Co-Borrower Invitation',
        subtitle: null,
        greeting: `Hello ${recipient_name},`,
        message: `<strong>${data.inviter_name}</strong> has invited you to join loan application <strong>#${data.application_number}</strong> as a co-borrower.`,
        info_box: {
          title: 'Application Details',
          items: [
            { label: 'Application Number', value: `#${data.application_number}` },
            { label: 'Primary Borrower', value: data.inviter_name }
          ]
        },
        cta_text: 'Review Invitation',
        cta_url: `${appUrl}/JoinRequest?type=co_borrower&application_id=${data.application_id}&inviter_id=${data.inviter_id}`
      },
      'request_co_owner': {
        subject: `${data.inviter_name} Wants to Add You as a Co-Owner of ${data.entity_name}`,
        title: 'Co-Owner Request',
        subtitle: null,
        greeting: `Hello ${recipient_name},`,
        message: `<strong>${data.inviter_name}</strong> has requested to add you as a co-owner of <strong>${data.entity_name}</strong>.${data.existing_owners ? `<br><br><strong>Current Owners:</strong> ${data.existing_owners}` : ''}`,
        info_box: null,
        cta_text: 'Review Request',
        cta_url: `${appUrl}/JoinRequest?type=co_owner&entity_id=${data.entity_id}&inviter_id=${data.inviter_id}`
      },
      'application_status_update': {
        subject: data.status_subject || 'Application Status Update',
        title: data.status_title || 'Application Status Updated',
        subtitle: null,
        greeting: `Hello ${recipient_name},`,
        message: data.status_message || `Your loan application status has been updated.`,
        description: data.status_description,
        info_box: {
          title: 'Application Details',
          items: [
            { label: 'Application Number', value: `#${data.application_number}` },
            { label: 'Applicant', value: data.borrower_name },
            { label: 'Status', value: data.status?.replace(/_/g, ' ').toUpperCase() }
          ]
        },
        cta_text: 'View Application Details',
        cta_url: `${appUrl}/NewApplication?id=${data.application_id}&action=view`
      },
      'loan_status_update': {
        subject: data.status_subject || 'Loan Status Update',
        title: data.status_title || 'Loan Status Updated',
        subtitle: null,
        greeting: `Hello ${recipient_name},`,
        message: data.status_message || `Your loan status has been updated.`,
        description: data.status_description,
        info_box: {
          title: 'Loan Details',
          items: [
            { label: 'Loan Number', value: `#${data.loan_number || 'N/A'}` },
            data.property_address ? { label: 'Property', value: data.property_address } : null,
            { label: 'Status', value: data.status?.replace(/_/g, ' ').toUpperCase() }
          ].filter(Boolean)
        },
        cta_text: 'View Loan Details',
        cta_url: `${appUrl}/LoanDetail?id=${data.loan_id}`
      },
      'daily_summary': {
        subject: `Daily Loan Summary - ${new Date().toLocaleDateString()}`,
        title: 'Daily Loan Summary',
        subtitle: null,
        greeting: `Hi ${recipient_name},`,
        message: `Here's your daily summary of loan activities and updates.`,
        daily_content: {
          hasUpdates: data.hasUpdates,
          notifications: data.notifications || [],
          overdueTasks: data.overdueTasks || [],
          upcomingTasks: data.upcomingTasks || []
        },
        cta_text: 'View Dashboard',
        cta_url: `${appUrl}/Dashboard`,
        footer_extra: `<p style="margin-top: 12px;"><a href="${appUrl}/MyProfile?tab=preferences" style="color: #60a5fa; text-decoration: none;">Manage Email Preferences</a></p>`
      },
      'generic_notification': {
        subject: data.subject || 'Notification from Amplend',
        title: data.title || 'New Notification',
        subtitle: null,
        greeting: `Hello ${recipient_name},`,
        message: data.message,
        badge: data.notification_type,
        cta_text: data.cta_text || 'View Details',
        cta_url: data.cta_url || `${appUrl}/Dashboard`
      }
    };

    const template = emailTemplates[email_type];
    if (!template) {
      return Response.json({ 
        error: `Unknown email type: ${email_type}` 
      }, { status: 400 });
    }

    // Build HTML email
    let htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #0f172a;
              margin: 0;
              padding: 24px 0;
              background: linear-gradient(135deg, #fafafa 0%, #f1f5f9 50%, #e2e8f0 100%);
            }
            .email-wrapper { max-width: 680px; margin: 0 auto; padding: 0 16px; }
            .container { 
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border-radius: 24px;
              overflow: hidden;
              border: 1px solid rgba(148, 163, 184, 0.35);
              box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.18);
            }
            .header { 
              padding: 28px 32px 20px;
              text-align: center;
              background: linear-gradient(135deg, #0f172a 0%, #020617 60%);
              border-bottom: 1px solid rgba(148, 163, 184, 0.4);
            }
            .logo { max-width: 200px; height: auto; margin-bottom: 6px; }
            .content { padding: 32px 32px 24px; }
            .content h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #0f172a; }
            .subtitle { font-size: 14px; color: #475569; padding-bottom: 30px; }
            .greeting { font-size: 15px; color: #0f172a; margin-bottom: 10px; }
            .content p { margin: 6px 0; color: #1e293b; font-size: 14px; line-height: 1.7; }
            .features { margin: 14px 0 24px 0; padding-left: 20px; }
            .features li { font-size: 14px; color: #1e293b; margin-bottom: 6px; }
            .info-box {
              background: #e0f2fe;
              border-left: 4px solid #3b82f6;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
            }
            .info-box-title { font-weight: 600; color: #0c4a6e; margin-bottom: 12px; font-size: 15px; }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid rgba(14, 116, 144, 0.15);
            }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: 600; color: #0e7490; font-size: 13px; }
            .info-value { color: #164e63; font-size: 13px; font-weight: 500; }
            .cta-wrapper { text-align: center; margin: 40px 0 30px 0; }
            .cta-button { 
              display: inline-block; 
              padding: 14px 30px; 
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: #ffffff !important; 
              text-decoration: none; 
              border-radius: 999px; 
              font-weight: 600;
              font-size: 15px;
              border: none;
              box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
            }
            .cta-note { font-size: 13px; color: #64748b; margin: 8px 0 20px 0; text-align: center; }
            .footer { 
              text-align: center; 
              padding: 18px 24px 22px;
              background: #020617;
              color: #94a3b8; 
              font-size: 12px;
            }
            .footer p { margin: 4px 0; }
            .footer strong { color: #e2e8f0; }
            .footer a { color: #60a5fa; text-decoration: none; }
            .badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px; background: rgba(96, 165, 250, 0.2); border: 1px solid rgba(96, 165, 250, 0.3); color: #93c5fd; }
            @media (max-width: 600px) {
              .content { padding: 24px 20px 20px; }
              .content h1 { font-size: 21px; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="container">
              <div class="header">
                <img src="${logoUrl}" alt="Amplend Logo" class="logo" />
              </div>
              
              <div class="content">
                <h1>${template.title}</h1>
                ${template.subtitle ? `<p class="subtitle">${template.subtitle}</p>` : ''}
                ${template.badge ? `<span class="badge">${template.badge.replace(/_/g, ' ')}</span>` : ''}

                <p class="greeting">${template.greeting}</p>
                <p>${template.message}</p>
                ${template.description ? `<p>${template.description}</p>` : ''}

                ${template.features ? `
                  <ul class="features">
                    ${template.features.map(f => `<li>${f}</li>`).join('')}
                  </ul>
                ` : ''}

                ${template.info_box ? `
                  <div class="info-box">
                    <div class="info-box-title">${template.info_box.title}</div>
                    ${template.info_box.items.map(item => `
                      <div class="info-row">
                        <span class="info-label">${item.label}:&nbsp;</span>
                        <span class="info-value">${item.value}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}`;

    // Handle daily summary special content
    if (email_type === 'daily_summary' && template.daily_content) {
      const dc = template.daily_content;
      htmlBody += `
        ${!dc.hasUpdates ? `
          <div class="info-box" style="text-align: center; border-left: 4px solid #94a3b8;">
            <p style="margin: 0; font-weight: 600;">✓ All Caught Up!</p>
            <p style="margin-top: 8px; font-size: 13px;">No new updates, tasks, or notifications today.</p>
          </div>
        ` : ''}
        ${dc.notifications.length > 0 ? `
          <h3 style="font-size: 16px; font-weight: 600; margin-top: 20px;">Recent Updates (${dc.notifications.length})</h3>
          ${dc.notifications.slice(0, 5).map(n => `
            <div class="info-box" style="border-left-color: #60a5fa;">
              <p style="margin: 0;">${n.message}</p>
            </div>
          `).join('')}
        ` : ''}
        ${dc.overdueTasks.length > 0 ? `
          <h3 style="font-size: 16px; font-weight: 600; margin-top: 20px;">Overdue Tasks (${dc.overdueTasks.length})</h3>
          ${dc.overdueTasks.slice(0, 5).map(t => `
            <div class="info-box" style="border-left-color: #ef4444;">
              <p style="margin: 0; font-weight: 600;">${t.item_name}</p>
              <p style="margin: 4px 0 0 0; font-size: 12px;">Due: ${new Date(t.due_date).toLocaleDateString()}</p>
            </div>
          `).join('')}
        ` : ''}
        ${dc.upcomingTasks.length > 0 ? `
          <h3 style="font-size: 16px; font-weight: 600; margin-top: 20px;">Upcoming Tasks (${dc.upcomingTasks.length})</h3>
          ${dc.upcomingTasks.slice(0, 5).map(t => `
            <div class="info-box" style="border-left-color: #f59e0b;">
              <p style="margin: 0; font-weight: 600;">${t.item_name}</p>
              <p style="margin: 4px 0 0 0; font-size: 12px;">Due: ${new Date(t.due_date).toLocaleDateString()}</p>
            </div>
          `).join('')}
        ` : ''}
      `;
    }

    htmlBody += `
                <div class="cta-wrapper">
                  <a href="${template.cta_url}" class="cta-button">
                    ${template.cta_text}
                  </a>
                </div>

                ${template.cta_note ? `<p class="cta-note">${template.cta_note}</p>` : ''}
              </div>
              
              <div class="footer">
                <p><strong>Amplend Loan Portal</strong></p>
                <p>This is an automated message. Please do not reply to this email.</p>
                ${template.footer_extra || ''}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Build plain text email
    let textBody = `
${template.title}
${'='.repeat(template.title.length)}

${template.greeting}

${template.message.replace(/<[^>]*>/g, '')}
${template.description ? `\n${template.description}` : ''}

${template.features ? template.features.map(f => `• ${f}`).join('\n') : ''}

${template.info_box ? `
${template.info_box.title}:
${template.info_box.items.map(item => `${item.label}: ${item.value}`).join('\n')}
` : ''}

${template.cta_text}: ${template.cta_url}

---
Amplend Loan Portal
This is an automated message.
    `.trim();

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const resendPayload = {
      from: 'Amplend Loan <loan-notification@amplend.net>',
      to: [recipient_email],
      subject: template.subject,
      html: htmlBody,
      text: textBody
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('[emailService] Resend API error:', errorData);
      return Response.json({ 
        error: 'Failed to send email via Resend',
        details: errorData,
        status: response.status
      }, { status: 500 });
    }

    const result = await response.json();

    return Response.json({ 
      success: true,
      message: 'Email sent successfully',
      message_id: result.id,
      details: {
        recipient: recipient_email,
        type: email_type
      }
    });

  } catch (error) {
    console.error('Error in emailService:', error);
    return Response.json({ 
      error: error.message || 'Failed to send email' 
    }, { status: 500 });
  }
});
