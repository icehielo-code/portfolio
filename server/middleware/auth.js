function auth(req, res, next) {
  const userId = parseInt(req.headers['x-user-id']) || 1;
  req.userId = userId;
  next();
}

module.exports = auth;
