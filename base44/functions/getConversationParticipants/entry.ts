import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversation_ids: conversationIds } = body || {};

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return Response.json({ error: 'conversation_ids is required' }, { status: 400 });
    }

    const participantIdSet = new Set();

    for (const conversationId of conversationIds) {
      if (!conversationId) continue;
      const messages = await base44.asServiceRole.entities.Message.filter({
        conversation_id: conversationId
      });

      if (!messages || messages.length === 0) continue;
      const participantIds = messages[0]?.participant_ids || [];

      if (!Array.isArray(participantIds) || !participantIds.includes(user.id)) {
        continue;
      }

      participantIds.forEach((id) => {
        if (id) participantIdSet.add(id);
      });
    }

    const users = await Promise.all(
      Array.from(participantIdSet).map(async (id) => {
        try {
          return await base44.asServiceRole.entities.User.get(id);
        } catch (error) {
          console.error('Error fetching user:', error);
          return null;
        }
      })
    );

    return Response.json({ users: users.filter(Boolean) });
  } catch (error) {
    console.error('Error fetching conversation participants:', error);
    return Response.json({
      error: error.message || 'Failed to fetch conversation participants'
    }, { status: 500 });
  }
});
