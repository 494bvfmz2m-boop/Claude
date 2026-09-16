function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.redirect('/login.html');
}

module.exports = { requireAuth };
