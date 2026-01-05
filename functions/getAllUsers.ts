import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow administrators and loan officers to fetch all users
    if (user.role !== 'admin' && user.app_role !== 'Administrator' && user.app_role !== 'Loan Officer') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list();

    return Response.json({ users });
  } catch (error) {
    console.error('Error fetching all users:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch users' 
    }, { status: 500 });
  }
});