const express = require('express');
const { ScheduledAnnouncements } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('announcements'));

router.get('/announcements', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('announcements', { guild, announcements: ScheduledAnnouncements.listForGuild(guild.id) });
});

router.get('/announcements/new', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('announcementForm', { guild, options: guildChannelOptions(guild) });
});

router.post('/announcements', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const channelId = req.body.channelId;
  const message = req.body.message?.trim();
  const when = req.body.sendAt; // datetime-local, no timezone -- interpreted as server-local time
  const recurrence = ['daily', 'weekly'].includes(req.body.recurrence) ? req.body.recurrence : 'none';

  if (!channelId || !message || !when) {
    return res.status(400).render('error', { message: 'Channel, message, and send time are all required.' });
  }
  const nextRun = new Date(when);
  if (Number.isNaN(nextRun.getTime())) {
    return res.status(400).render('error', { message: "That send time doesn't look right." });
  }

  ScheduledAnnouncements.create(guild.id, {
    channelId, message, recurrence, nextRun: nextRun.toISOString(), createdBy: req.session.discordUser?.id,
  });
  res.redirect(`/dashboard/${guild.id}/announcements`);
});

router.post('/announcements/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const announcement = ScheduledAnnouncements.get(req.params.id);
  if (announcement && announcement.guild_id === guild.id) ScheduledAnnouncements.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/announcements`);
});

module.exports = router;
