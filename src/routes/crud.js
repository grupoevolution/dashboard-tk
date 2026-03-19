const router = require('express').Router();
const { db } = require('../db/database');
const auth = require('../middleware/auth');

// ══════════════════════════════
// VENDEDORES
// ══════════════════════════════

// GET /api/vendedores  (público para a página do vendedor verificar slug)
router.get('/vendedores', (req, res) => {
  const vendedores = db.prepare('SELECT id, nome, slug FROM vendedores WHERE ativo=1 ORDER BY nome').all();
  res.json(vendedores);
});

// GET /api/vendedores/:slug  (público)
router.get('/vendedores/:slug', (req, res) => {
  const v = db.prepare('SELECT id, nome, slug FROM vendedores WHERE slug=? AND ativo=1').get(req.params.slug);
  if (!v) return res.status(404).json({ erro: 'Vendedor não encontrado' });
  res.json(v);
});

// POST /api/vendedores (admin)
router.post('/vendedores', auth, (req, res) => {
  const { nome, email } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  const slug = nome.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
  try {
    const r = db.prepare('INSERT INTO vendedores (nome, slug, email) VALUES (?,?,?)').run(nome, slug, email||null);
    res.json({ ok: true, id: r.lastInsertRowid, slug });
  } catch {
    res.status(409).json({ erro: 'Slug já existente (nome duplicado)' });
  }
});

// PUT /api/vendedores/:id (admin)
router.put('/vendedores/:id', auth, (req, res) => {
  const { nome, email, ativo } = req.body;
  const v = db.prepare('SELECT * FROM vendedores WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ erro: 'Não encontrado' });
  db.prepare('UPDATE vendedores SET nome=?, email=?, ativo=? WHERE id=?')
    .run(nome||v.nome, email||v.email, ativo!==undefined?(ativo?1:0):v.ativo, req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════
// PRODUTOS
// ══════════════════════════════

// GET /api/produtos (admin + público para selects)
router.get('/produtos', (req, res) => {
  const produtos = db.prepare('SELECT * FROM produtos WHERE ativo=1 ORDER BY nome_dash').all();
  res.json(produtos);
});

// POST /api/produtos (admin)
router.post('/produtos', auth, (req, res) => {
  const { nome_completo, nome_dash, categoria, codigo_kiwify, codigo_ticto, codigo_lastlink } = req.body;
  if (!nome_completo || !nome_dash) return res.status(400).json({ erro: 'nome_completo e nome_dash são obrigatórios' });
  const r = db.prepare(`
    INSERT INTO produtos (nome_completo, nome_dash, categoria, codigo_kiwify, codigo_ticto, codigo_lastlink)
    VALUES (?,?,?,?,?,?)
  `).run(nome_completo, nome_dash, categoria||'Curso', codigo_kiwify||null, codigo_ticto||null, codigo_lastlink||null);
  res.json({ ok: true, id: r.lastInsertRowid });
});

// PUT /api/produtos/:id (admin)
router.put('/produtos/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM produtos WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Não encontrado' });
  const { nome_completo, nome_dash, categoria, codigo_kiwify, codigo_ticto, codigo_lastlink, ativo } = req.body;
  db.prepare(`
    UPDATE produtos SET nome_completo=?, nome_dash=?, categoria=?,
    codigo_kiwify=?, codigo_ticto=?, codigo_lastlink=?, ativo=? WHERE id=?
  `).run(
    nome_completo||p.nome_completo, nome_dash||p.nome_dash, categoria||p.categoria,
    codigo_kiwify||p.codigo_kiwify, codigo_ticto||p.codigo_ticto, codigo_lastlink||p.codigo_lastlink,
    ativo!==undefined?(ativo?1:0):p.ativo, req.params.id
  );
  res.json({ ok: true });
});

// DELETE /api/produtos/:id (admin) — soft delete
router.delete('/produtos/:id', auth, (req, res) => {
  db.prepare('UPDATE produtos SET ativo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════
// REGISTROS DE VENDEDORES
// ══════════════════════════════

// GET /api/registros (admin)
router.get('/registros', auth, (req, res) => {
  const { vendedor_id, produto_id, data_inicio, data_fim } = req.query;
  let where = 'WHERE 1=1';
  if (vendedor_id) where += ` AND r.vendedor_id=${parseInt(vendedor_id)}`;
  if (produto_id)  where += ` AND r.produto_id=${parseInt(produto_id)}`;
  if (data_inicio) where += ` AND r.data_registro >= '${data_inicio}'`;
  if (data_fim)    where += ` AND r.data_registro <= '${data_fim}'`;

  const registros = db.prepare(`
    SELECT r.*, v.nome as vendedor_nome, p.nome_dash as produto_nome
    FROM registros_vendedor r
    LEFT JOIN vendedores v ON r.vendedor_id = v.id
    LEFT JOIN produtos p ON r.produto_id = p.id
    ${where}
    ORDER BY r.data_registro DESC, r.criado_em DESC
    LIMIT 500
  `).all();
  res.json(registros);
});

// GET /api/registros/vendedor/:slug (público — para a página do vendedor)
router.get('/registros/vendedor/:slug', (req, res) => {
  const v = db.prepare('SELECT id FROM vendedores WHERE slug=? AND ativo=1').get(req.params.slug);
  if (!v) return res.status(404).json({ erro: 'Vendedor não encontrado' });

  const registros = db.prepare(`
    SELECT r.*, p.nome_dash as produto_nome
    FROM registros_vendedor r
    LEFT JOIN produtos p ON r.produto_id = p.id
    WHERE r.vendedor_id = ?
    ORDER BY r.data_registro DESC LIMIT 30
  `).all(v.id);
  res.json(registros);
});

// POST /api/registros (público — vendedor preenche)
router.post('/registros', (req, res) => {
  const { slug, produto_id, data_registro, canal, qtd_leads, qtd_conversoes, valor_total, status, observacao } = req.body;
  if (!slug) return res.status(400).json({ erro: 'slug do vendedor obrigatório' });

  const v = db.prepare('SELECT id FROM vendedores WHERE slug=? AND ativo=1').get(slug);
  if (!v) return res.status(404).json({ erro: 'Vendedor não encontrado' });

  const hoje = new Date().toISOString().split('T')[0];
  const r = db.prepare(`
    INSERT INTO registros_vendedor
    (vendedor_id, produto_id, data_registro, canal, qtd_leads, qtd_conversoes, valor_total, status, observacao)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    v.id, produto_id||null, data_registro||hoje, canal||null,
    parseInt(qtd_leads)||0, parseInt(qtd_conversoes)||0,
    parseFloat(valor_total)||0, status||'concluido', observacao||null
  );
  res.json({ ok: true, id: r.lastInsertRowid });
});

// GET /api/comercial/ranking (admin)
router.get('/comercial/ranking', auth, (req, res) => {
  const { periodo='30d', data_inicio, data_fim } = req.query;
  // calcula datas
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  let inicio, fim = fmt(now);
  switch(periodo){
    case 'hoje': inicio=fim; break;
    case '7d':  { const d=new Date(now);d.setDate(d.getDate()-7);inicio=fmt(d); break; }
    case 'mes_atual': inicio=`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`; break;
    default: { const d=new Date(now);d.setDate(d.getDate()-30);inicio=fmt(d); }
  }
  if (data_inicio) inicio = data_inicio;
  if (data_fim) fim = data_fim;

  const ranking = db.prepare(`
    SELECT
      v.id, v.nome, v.slug,
      COUNT(r.id) as registros,
      SUM(r.qtd_leads) as total_leads,
      SUM(r.qtd_conversoes) as total_conversoes,
      SUM(r.valor_total) as faturamento,
      CASE WHEN SUM(r.qtd_leads)>0
        THEN ROUND(SUM(r.qtd_conversoes)*100.0/SUM(r.qtd_leads),1)
        ELSE 0 END as taxa_conversao
    FROM vendedores v
    LEFT JOIN registros_vendedor r ON r.vendedor_id=v.id
      AND r.data_registro BETWEEN '${inicio}' AND '${fim}'
    WHERE v.ativo=1
    GROUP BY v.id
    ORDER BY faturamento DESC
  `).all();

  res.json({ inicio, fim, ranking });
});

module.exports = router;
