import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.filter({
      role: 'Loan Officer'
    });

    return Response.json({ users });
  } catch (error) {
    console.error('Error fetching loan officers:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch loan officers' 
    }, { status: 500 });
  }
});