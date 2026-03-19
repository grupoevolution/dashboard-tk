const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '');

  const isApi = req.originalUrl.startsWith('/api/');

  if (!token) {
    if (isApi) return res.status(401).json({ erro: 'Não autenticado' });
    return res.redirect('/login');
  }
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    if (isApi) return res.status(401).json({ erro: 'Token inválido ou expirado' });
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

module.exports = authMiddleware;
