const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '');
  if (!token) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Não autenticado' });
    return res.redirect('/login');
  }
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Token inválido' });
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

module.exports = authMiddleware;
