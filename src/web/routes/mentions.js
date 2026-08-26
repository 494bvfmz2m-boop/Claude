const express = require('express');
const { getGuildOr404 } = require('../lib/getGuild');
const { resolveMember } = require('../lib/resolveMember');

const router = express.Router({ mergeParams: true });

// Backs the "insert user mention" button on the embed builder, ticket type
// welcome embed, and panel embed forms -- resolves a typed username to a
// real Discord user ID so the correct <@id> mention token can be inserted.
router.get('/mentions/resolve-user', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const member = await resolveMember(guild, q);
  if (!member) return res.status(404).json({ error: 'Not found' });

  res.json({ id: member.id, tag: member.user.tag });
});

module.exports = router;
