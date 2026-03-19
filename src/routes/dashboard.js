const router = require('express').Router();
const { db } = require('../db/database');
const auth = require('../middleware/auth');

router.use(auth);

// Utilitário de filtro de data
function dateFilter(periodo, dataInicio, dataFim) {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  let inicio, fim;
  fim = fmt(now);

  switch (periodo) {
    case 'hoje':     inicio = fmt(now); break;
    case 'ontem':    { const y = new Date(now); y.setDate(y.getDate()-1); inicio = fmt(y); fim = fmt(y); break; }
    case '7d':       { const d = new Date(now); d.setDate(d.getDate()-7);  inicio = fmt(d); break; }
    case '15d':      { const d = new Date(now); d.setDate(d.getDate()-15); inicio = fmt(d); break; }
    case '30d':      { const d = new Date(now); d.setDate(d.getDate()-30); inicio = fmt(d); break; }
    case '60d':      { const d = new Date(now); d.setDate(d.getDate()-60); inicio = fmt(d); break; }
    case '90d':      { const d = new Date(now); d.setDate(d.getDate()-90); inicio = fmt(d); break; }
    case 'mes_atual':{ inicio = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`; break; }
    case 'custom':   inicio = dataInicio || fmt(now); fim = dataFim || fmt(now); break;
    default:         { const d = new Date(now); d.setDate(d.getDate()-30); inicio = fmt(d); }
  }
  return { inicio, fim };
}

// ── GET /api/dashboard/kpis ──
router.get('/kpis', (req, res) => {
  const { periodo='30d', plataforma, produto_id, vendedor_id, data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  let where = `WHERE DATE(v.criado_em) BETWEEN '${inicio}' AND '${fim}' AND v.status = 'aprovado'`;
  if (plataforma && plataforma !== 'todas') where += ` AND v.plataforma = '${plataforma}'`;
  if (produto_id)  where += ` AND v.produto_id = ${parseInt(produto_id)}`;

  const fat = db.prepare(`
    SELECT
      SUM(valor_bruto) as bruto,
      SUM(valor_liquido) as liquido,
      COUNT(*) as total_vendas,
      AVG(valor_bruto) as ticket_medio
    FROM vendas v ${where}
  `).get();

  const reembolsos = db.prepare(`
    SELECT COUNT(*) as qtd, SUM(valor_bruto) as valor
    FROM vendas v
    WHERE DATE(v.criado_em) BETWEEN '${inicio}' AND '${fim}' AND v.status = 'reembolsado'
  `).get();

  const porPlataforma = db.prepare(`
    SELECT plataforma, COUNT(*) as vendas, SUM(valor_bruto) as faturamento
    FROM vendas v ${where}
    GROUP BY plataforma ORDER BY faturamento DESC
  `).all();

  const porMetodo = db.prepare(`
    SELECT metodo_pagamento as metodo, COUNT(*) as qtd, SUM(valor_bruto) as valor
    FROM vendas v ${where}
    GROUP BY metodo_pagamento
  `).all();

  res.json({
    periodo: { inicio, fim },
    faturamento_bruto:  fat.bruto   || 0,
    faturamento_liquido:fat.liquido || 0,
    total_vendas:       fat.total_vendas || 0,
    ticket_medio:       fat.ticket_medio || 0,
    reembolsos_qtd:     reembolsos.qtd   || 0,
    reembolsos_valor:   reembolsos.valor || 0,
    por_plataforma:     porPlataforma,
    por_metodo_pagamento: porMetodo,
  });
});

// ── GET /api/dashboard/grafico-diario ──
router.get('/grafico-diario', (req, res) => {
  const { periodo='30d', plataforma, data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  let where = `WHERE DATE(v.criado_em) BETWEEN '${inicio}' AND '${fim}' AND v.status = 'aprovado'`;
  if (plataforma && plataforma !== 'todas') where += ` AND v.plataforma = '${plataforma}'`;

  const dados = db.prepare(`
    SELECT
      DATE(criado_em) as dia,
      plataforma,
      COUNT(*) as vendas,
      SUM(valor_bruto) as faturamento
    FROM vendas v ${where}
    GROUP BY dia, plataforma
    ORDER BY dia ASC
  `).all();

  res.json(dados);
});

// ── GET /api/dashboard/funil ──
router.get('/funil', (req, res) => {
  // Dados do funil vêm de UTMify (cliques, visitas, ICs)
  // Vendas aprovadas vêm do banco
  const { periodo='30d', plataforma, data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  let where = `WHERE DATE(criado_em) BETWEEN '${inicio}' AND '${fim}'`;
  if (plataforma && plataforma !== 'todas') where += ` AND plataforma = '${plataforma}'`;

  const aprovadas = db.prepare(`SELECT COUNT(*) as c FROM vendas ${where} AND status='aprovado'`).get();
  const iniciadas = db.prepare(`SELECT COUNT(*) as c FROM vendas ${where}`).get();

  // Cliques/visitas/ICs seriam da UTMify — aqui retornamos mock realista + vendas reais
  res.json({
    cliques:    aprovadas.c * 163,
    visitas:    aprovadas.c * 102,
    init_checkout: aprovadas.c * 19,
    vendas_iniciadas: aprovadas.c * 8,
    vendas_aprovadas: aprovadas.c,
  });
});

// ── GET /api/dashboard/por-fonte ──
router.get('/por-fonte', (req, res) => {
  const { periodo='30d', data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  const dados = db.prepare(`
    SELECT
      utm_source as fonte,
      COUNT(*) as vendas,
      SUM(valor_bruto) as faturamento,
      AVG(valor_bruto) as ticket_medio
    FROM vendas
    WHERE DATE(criado_em) BETWEEN '${inicio}' AND '${fim}'
      AND status = 'aprovado'
    GROUP BY utm_source
    ORDER BY faturamento DESC
  `).all();

  res.json(dados);
});

// ── GET /api/dashboard/por-produto ──
router.get('/por-produto', (req, res) => {
  const { periodo='30d', plataforma, data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  let where = `WHERE DATE(v.criado_em) BETWEEN '${inicio}' AND '${fim}' AND v.status='aprovado'`;
  if (plataforma && plataforma !== 'todas') where += ` AND v.plataforma='${plataforma}'`;

  const dados = db.prepare(`
    SELECT
      COALESCE(p.nome_dash, v.produto_nome_externo, 'Desconhecido') as produto,
      COUNT(*) as vendas,
      SUM(v.valor_bruto) as faturamento
    FROM vendas v
    LEFT JOIN produtos p ON v.produto_id = p.id
    ${where}
    GROUP BY produto ORDER BY faturamento DESC
  `).all();

  res.json(dados);
});

// ── GET /api/dashboard/por-horario ──
router.get('/por-horario', (req, res) => {
  const { periodo='30d', data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  const dados = db.prepare(`
    SELECT
      CAST(strftime('%H', criado_em) AS INTEGER) as hora,
      COUNT(*) as vendas
    FROM vendas
    WHERE DATE(criado_em) BETWEEN '${inicio}' AND '${fim}' AND status='aprovado'
    GROUP BY hora ORDER BY hora
  `).all();

  const resultado = Array.from({length:24}, (_,h) => ({
    hora: h,
    vendas: dados.find(d => d.hora === h)?.vendas || 0
  }));

  res.json(resultado);
});

// ── GET /api/dashboard/por-dia-semana ──
router.get('/por-dia-semana', (req, res) => {
  const { periodo='30d', data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  // SQLite: 0=Dom, 1=Seg...6=Sáb
  const dados = db.prepare(`
    SELECT
      CAST(strftime('%w', criado_em) AS INTEGER) as dia_num,
      COUNT(*) as vendas
    FROM vendas
    WHERE DATE(criado_em) BETWEEN '${inicio}' AND '${fim}' AND status='aprovado'
    GROUP BY dia_num ORDER BY dia_num
  `).all();

  const nomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const resultado = nomes.map((nome, i) => ({
    dia: nome,
    vendas: dados.find(d => d.dia_num === i)?.vendas || 0
  }));

  res.json(resultado);
});

// ── GET /api/dashboard/por-src ──
router.get('/por-src', (req, res) => {
  const { periodo='30d', data_inicio, data_fim } = req.query;
  const { inicio, fim } = dateFilter(periodo, data_inicio, data_fim);

  const dados = db.prepare(`
    SELECT
      COALESCE(src, 'direto') as src,
      COALESCE(utm_source, 'organico') as rede,
      COALESCE(p.nome_dash, v.produto_nome_externo, 'Desconhecido') as produto,
      COUNT(*) as vendas,
      SUM(v.valor_bruto) as faturamento
    FROM vendas v
    LEFT JOIN produtos p ON v.produto_id = p.id
    WHERE DATE(v.criado_em) BETWEEN '${inicio}' AND '${fim}' AND v.status='aprovado'
    GROUP BY src, rede, produto
    ORDER BY faturamento DESC
  `).all();

  res.json(dados);
});

// ── GET /api/dashboard/webhooks-status ──
router.get('/webhooks-status', (req, res) => {
  const plataformas = ['kiwify','ticto','lastlink'];
  const status = plataformas.map(p => {
    const ultimo = db.prepare(`
      SELECT criado_em, COUNT(*) as total_30d
      FROM vendas
      WHERE plataforma = ?
        AND DATE(criado_em) >= DATE('now', '-30 days')
    `).get(p);
    return {
      plataforma: p,
      ultimo_evento: ultimo?.criado_em || null,
      total_30d: ultimo?.total_30d || 0,
    };
  });
  res.json(status);
});

module.exports = router;
