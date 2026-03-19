const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const auth = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

  const admin = db.prepare('SELECT * FROM admins WHERE email = ? AND ativo = 1').get(email.toLowerCase().trim());
  if (!admin || !bcrypt.compareSync(senha, admin.senha_hash))
    return res.status(401).json({ erro: 'Credenciais inválidas' });

  const token = jwt.sign(
    { id: admin.id, nome: admin.nome, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ ok: true, admin: { id: admin.id, nome: admin.nome, email: admin.email } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ admin: req.admin });
});

// GET /api/auth/admins
router.get('/admins', auth, (req, res) => {
  const admins = db.prepare('SELECT id, nome, email, ativo, criado_em FROM admins ORDER BY id').all();
  res.json(admins);
});

// POST /api/auth/admins
router.post('/admins', auth, (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, senha' });
  const hash = bcrypt.hashSync(senha, 10);
  try {
    const r = db.prepare('INSERT INTO admins (nome, email, senha_hash) VALUES (?, ?, ?)').run(nome, email.toLowerCase(), hash);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) {
    res.status(409).json({ erro: 'Email já cadastrado' });
  }
});

// PUT /api/auth/admins/:id
router.put('/admins/:id', auth, (req, res) => {
  const { nome, email, senha, ativo } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!admin) return res.status(404).json({ erro: 'Admin não encontrado' });

  const novoNome = nome || admin.nome;
  const novoEmail = email ? email.toLowerCase() : admin.email;
  const novoHash = senha ? bcrypt.hashSync(senha, 10) : admin.senha_hash;
  const novoAtivo = ativo !== undefined ? (ativo ? 1 : 0) : admin.ativo;

  db.prepare('UPDATE admins SET nome=?, email=?, senha_hash=?, ativo=? WHERE id=?')
    .run(novoNome, novoEmail, novoHash, novoAtivo, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/auth/admins/:id
router.delete('/admins/:id', auth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM admins WHERE ativo=1').get();
  if (total.c <= 1) return res.status(400).json({ erro: 'Não é possível remover o último admin ativo' });
  db.prepare('UPDATE admins SET ativo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
