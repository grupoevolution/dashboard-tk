const router = require('express').Router();
const { db } = require('../db/database');

// Utilitário: encontrar produto pelo código externo
function findProduto(plataforma, codigoExterno) {
  if (!codigoExterno) return null;
  const campo = plataforma === 'kiwify' ? 'codigo_kiwify'
              : plataforma === 'ticto'   ? 'codigo_ticto'
              : plataforma === 'lastlink'? 'codigo_lastlink'
              : null;
  if (!campo) return null;
  return db.prepare(`SELECT id FROM produtos WHERE ${campo} = ? AND ativo = 1`).get(String(codigoExterno));
}

function inserirVenda(dados) {
  return db.prepare(`
    INSERT INTO vendas (
      plataforma, evento, produto_id, produto_codigo_externo, produto_nome_externo,
      valor_bruto, valor_liquido, metodo_pagamento, status,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, src,
      cliente_nome, cliente_email, cliente_doc, payload_raw
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    dados.plataforma, dados.evento, dados.produto_id || null,
    dados.produto_codigo_externo || null, dados.produto_nome_externo || null,
    dados.valor_bruto || 0, dados.valor_liquido || 0,
    dados.metodo_pagamento || null, dados.status || 'aprovado',
    dados.utm_source || null, dados.utm_medium || null,
    dados.utm_campaign || null, dados.utm_content || null,
    dados.utm_term || null, dados.src || null,
    dados.cliente_nome || null, dados.cliente_email || null,
    dados.cliente_doc || null, dados.payload_raw || null
  );
}

// ── KIWIFY ──
// POST /api/webhooks/kiwify
router.post('/kiwify', (req, res) => {
  try {
    const body = req.body;
    const evento = body.event || 'unknown';

    // Só processa vendas aprovadas
    const eventosValidos = ['order_approved', 'order_complete', 'order.approved'];
    if (!eventosValidos.includes(evento)) return res.json({ ok: true, ignorado: true });

    const data = body.data || body;
    const prodCodigo = data?.product?.id || data?.product_id || null;
    const produto = findProduto('kiwify', prodCodigo);

    const metodo = (data?.payment?.payment_method || data?.payment_method || '').toLowerCase();
    const metodoPag = metodo.includes('credit') ? 'cartao'
                    : metodo.includes('pix')    ? 'pix'
                    : metodo.includes('boleto') ? 'boleto' : metodo;

    inserirVenda({
      plataforma: 'kiwify',
      evento,
      produto_id: produto?.id,
      produto_codigo_externo: prodCodigo,
      produto_nome_externo: data?.product?.name || null,
      valor_bruto: parseFloat(data?.order_value || data?.value || 0),
      valor_liquido: parseFloat(data?.net_value || data?.order_value || 0),
      metodo_pagamento: metodoPag,
      status: 'aprovado',
      utm_source:   data?.utm_source   || data?.tracking?.utm_source   || null,
      utm_medium:   data?.utm_medium   || data?.tracking?.utm_medium   || null,
      utm_campaign: data?.utm_campaign || data?.tracking?.utm_campaign || null,
      utm_content:  data?.utm_content  || data?.tracking?.utm_content  || null,
      utm_term:     data?.utm_term     || data?.tracking?.utm_term     || null,
      src:          data?.src          || data?.tracking?.src          || null,
      cliente_nome:  data?.customer?.name  || data?.buyer?.name  || null,
      cliente_email: data?.customer?.email || data?.buyer?.email || null,
      cliente_doc:   data?.customer?.doc   || data?.buyer?.cpf   || null,
      payload_raw: JSON.stringify(body),
    });

    res.json({ ok: true, plataforma: 'kiwify' });
  } catch (e) {
    console.error('Webhook Kiwify erro:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ── TICTO ──
// POST /api/webhooks/ticto
router.post('/ticto', (req, res) => {
  try {
    const body = req.body;
    const tipo = body.tipo || body.event || body.type || 'unknown';

    const eventosValidos = ['purchase.approved','venda.aprovada','order.approved','PURCHASE_APPROVED'];
    const tipoNorm = tipo.toLowerCase().replace(/[._]/g, '.');
    const valido = eventosValidos.some(e => e.toLowerCase() === tipoNorm || tipo === e);
    if (!valido) return res.json({ ok: true, ignorado: true });

    const venda = body.venda || body.data || body;
    const prodCodigo = String(venda?.produto_id || venda?.product_id || '');
    const produto = findProduto('ticto', prodCodigo);

    const metodo = (venda?.forma_pagamento || venda?.payment_method || '').toLowerCase();
    const metodoPag = metodo.includes('cart') ? 'cartao'
                    : metodo.includes('pix')   ? 'pix'
                    : metodo.includes('boleto')? 'boleto' : metodo;

    inserirVenda({
      plataforma: 'ticto',
      evento: tipo,
      produto_id: produto?.id,
      produto_codigo_externo: prodCodigo,
      produto_nome_externo: venda?.produto_nome || venda?.product_name || null,
      valor_bruto: parseFloat(venda?.valor || venda?.amount || 0),
      valor_liquido: parseFloat(venda?.valor_liquido || venda?.net_amount || venda?.valor || 0),
      metodo_pagamento: metodoPag,
      status: 'aprovado',
      utm_source:   venda?.utm_source   || null,
      utm_medium:   venda?.utm_medium   || null,
      utm_campaign: venda?.utm_campaign || null,
      utm_content:  venda?.utm_content  || null,
      utm_term:     venda?.utm_term     || null,
      src:          venda?.src          || null,
      cliente_nome:  venda?.cliente?.nome  || venda?.customer?.name  || null,
      cliente_email: venda?.cliente?.email || venda?.customer?.email || null,
      cliente_doc:   venda?.cliente?.cpf   || venda?.customer?.doc   || null,
      payload_raw: JSON.stringify(body),
    });

    res.json({ ok: true, plataforma: 'ticto' });
  } catch (e) {
    console.error('Webhook Ticto erro:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ── LASTLINK ──
// POST /api/webhooks/lastlink
router.post('/lastlink', (req, res) => {
  try {
    const body = req.body;
    const evento = body.event_type || body.event || body.tipo || 'unknown';

    const eventosValidos = ['sale_approved','sale.approved','purchase_approved','SALE_APPROVED'];
    const valido = eventosValidos.some(e => e.toLowerCase() === evento.toLowerCase());
    if (!valido) return res.json({ ok: true, ignorado: true });

    const sale = body.sale || body.data || body;
    const prodCodigo = sale?.product_id || sale?.produto_id || null;
    const produto = findProduto('lastlink', prodCodigo);

    // Lastlink envia em centavos
    const valorBruto = parseFloat(sale?.amount || sale?.valor || 0) / 100;
    const metodo = (sale?.payment_type || sale?.forma_pagamento || '').toLowerCase();
    const metodoPag = metodo.includes('credit') || metodo.includes('card') ? 'cartao'
                    : metodo.includes('pix')  ? 'pix'
                    : metodo.includes('bole') ? 'boleto' : metodo;

    inserirVenda({
      plataforma: 'lastlink',
      evento,
      produto_id: produto?.id,
      produto_codigo_externo: prodCodigo,
      produto_nome_externo: sale?.product_name || sale?.produto_nome || null,
      valor_bruto: valorBruto,
      valor_liquido: parseFloat(sale?.net_amount || 0) / 100 || valorBruto * 0.9,
      metodo_pagamento: metodoPag,
      status: 'aprovado',
      utm_source:   sale?.utm_source   || null,
      utm_medium:   sale?.utm_medium   || null,
      utm_campaign: sale?.utm_campaign || null,
      utm_content:  sale?.utm_content  || null,
      utm_term:     sale?.utm_term     || null,
      src:          sale?.src          || null,
      cliente_nome:  sale?.customer?.name  || sale?.buyer_name  || null,
      cliente_email: sale?.customer?.email || sale?.buyer_email || null,
      cliente_doc:   sale?.customer?.doc   || sale?.buyer_cpf   || null,
      payload_raw: JSON.stringify(body),
    });

    res.json({ ok: true, plataforma: 'lastlink' });
  } catch (e) {
    console.error('Webhook Lastlink erro:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
