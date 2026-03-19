require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { init } = require('./db/database');
const authRoutes      = require('./routes/auth');
const webhookRoutes   = require('./routes/webhooks');
const dashboardRoutes = require('./routes/dashboard');
const crudRoutes      = require('./routes/crud');
const authMiddleware  = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Segurança e logging ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body parsers ──
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Rate limit ──
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20, message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' } }));
app.use('/api/webhooks',   rateLimit({ windowMs: 60*1000, max: 300 }));
app.use('/api/',           rateLimit({ windowMs: 60*1000, max: 500 }));

// ── Arquivos estáticos ──
app.use(express.static(path.join(__dirname, '../public')));

// ── Rotas da API ──
app.use('/api/auth',      authRoutes);
app.use('/api/webhooks',  webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api',           crudRoutes);

// ── Rotas de página ──

// Login (público)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Página do vendedor (público) — ex: /lucasmoreira
app.get('/:slug([a-z0-9]+)', (req, res) => {
  const { db } = require('./db/database');
  const v = db.prepare('SELECT id FROM vendedores WHERE slug=? AND ativo=1').get(req.params.slug);
  if (!v) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../public/vendedor.html'));
});

// Dashboard (protegido)
app.get('/', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Catch-all: redireciona para login
app.get('*', (req, res) => res.redirect('/login'));

// ── Inicialização ──
init();
app.listen(PORT, () => {
  console.log(`Dashboard rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
