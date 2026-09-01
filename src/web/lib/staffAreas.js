// The delegable areas of /staff -- what a custom staff role (see
// db/repo.js's StaffRoles) can be scoped to. Deliberately excludes managing
// admins/roles themselves and the database backup, which stay owner-only
// no matter what -- same invariant the "full admin" tier already has
// ("an added admin can't add more admins or lock the real owner out").
const STAFF_AREAS = [
  { key: 'beta', label: 'Closed beta & allowlist', description: 'Toggle closed beta, manage the allowlist, and send test beta DMs.' },
  { key: 'blocklist', label: 'Global blocklist', description: 'Block or unblock a Discord user bot-wide, across every server.' },
  { key: 'contacts', label: 'Contacts', description: 'Save and remove saved contacts for DMing.' },
  { key: 'emoji_book', label: 'Emoji book', description: 'Save and remove custom emoji markup.' },
  { key: 'server_notes', label: 'Server notes', description: 'Private notes about a server, visible only here.' },
  { key: 'dm_form', label: 'Application form templates', description: 'Create, edit, and delete DM form templates.' },
  { key: 'send_dm', label: 'Send a DM', description: 'DM contacts or pasted user IDs as XyphrosMod.' },
  { key: 'broadcast', label: 'Broadcast to server owners', description: 'DM every server owner XyphrosMod has, all at once.' },
  { key: 'maintenance', label: 'Maintenance banner', description: 'Toggle the dashboard-wide maintenance banner.' },
  { key: 'remove_server', label: 'Remove from a server', description: 'Make XyphrosMod leave a server.' },
];
const STAFF_AREA_KEYS = new Set(STAFF_AREAS.map((a) => a.key));

module.exports = { STAFF_AREAS, STAFF_AREA_KEYS };
