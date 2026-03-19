// ══════════════════════════════════════════════
// DASH.JS — Dashboard Frontend
// ══════════════════════════════════════════════

// ── Chart defaults ──
Chart.defaults.color = '#5a5a6a';
Chart.defaults.borderColor = '#2a2a32';
Chart.defaults.font.family = "'Geist Mono', monospace";
Chart.defaults.font.size = 11;

const ACC  = '#5b7cff';
const G1   = '#3e3e4a';
const G2   = '#555';
const UP   = '#3ecf8e';
const DN   = '#f06060';
const YN   = '#e8a030';
const DAYS = Array.from({length:15},(_,i)=>String(i*2+1).padStart(2,'0'));

let charts = {};
let currentPage = 'resumo';

// ── Filtros ──
function getFilters() {
  return {
    periodo:   document.getElementById('f-periodo')?.value   || '30d',
    fonte:     document.getElementById('f-fonte')?.value     || '',
    plataforma:document.getElementById('f-plataforma')?.value|| '',
    produto_id:document.getElementById('f-produto')?.value   || '',
    vendedor_id:document.getElementById('f-vendedor')?.value || '',
  };
}

function applyFilters() {
  loadPage(currentPage);
  updateTimestamp();
}

function updateTimestamp() {
  const el = document.getElementById('upd-text');
  if (el) el.textContent = 'Atualizado agora';
  let sec = 0;
  clearInterval(window._updInterval);
  window._updInterval = setInterval(() => {
    sec++;
    if (el) el.textContent = `Atualizado há ${sec}s`;
  }, 1000);
}

// ── Navigation ──
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('pg-' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');
  currentPage = id;
  loadPage(id);
}

function loadPage(id) {
  if (id === 'resumo')     loadResumo();
  if (id === 'meta')       loadMeta();
  if (id === 'google')     loadGoogle();
  if (id === 'tiktok')     loadTiktok();
  if (id === 'utms')       loadUTMs();
  if (id === 'comercial')  loadComercial();
  if (id === 'registros')  loadRegistros();
  if (id === 'financeiro') loadFinanceiro();
  if (id === 'produtos')   loadProdutos();
  if (id === 'integ')      loadInteg();
  if (id === 'config')     loadConfig();
}

// ── API helper ──
async function api(path) {
  try {
    const r = await fetch('/api/' + path);
    if (r.status === 401) { window.location.href = '/login'; return null; }
    return await r.json();
  } catch { return null; }
}

function qs(obj) {
  return Object.entries(obj).filter(([,v]) => v).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ── Format ──
function fBRL(v) {
  if (v === null || v === undefined) return 'R$ 0';
  if (v >= 1000000) return 'R$ ' + (v/1000000).toFixed(2).replace('.',',') + 'M';
  if (v >= 1000)    return 'R$ ' + (v/1000).toFixed(1).replace('.',',') + 'k';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function fNum(v) { return Number(v||0).toLocaleString('pt-BR'); }
function fPct(v) { return Number(v||0).toFixed(1) + '%'; }

// ── KPI builder ──
function buildKPI(label, val, delta, sub, icon='') {
  const cls = delta === null ? 'nt' : (delta >= 0 ? 'up' : 'dn');
  const arrow = delta === null ? '' : (delta >= 0 ? '<i class="fas fa-arrow-up"></i> ' : '<i class="fas fa-arrow-down"></i> ');
  const deltaHtml = delta === null ? '' : `<span class="delta ${cls}">${arrow}${Math.abs(delta)}%</span>`;
  return `<div class="kpi">
    <div class="kpi-top"><span class="kpi-label">${label}</span>${icon?`<div class="kpi-icon"><i class="${icon}"></i></div>`:''}  </div>
    <div class="kpi-val sm">${val}</div>
    <div class="kpi-footer">${deltaHtml}<span class="kpi-sub">${sub||''}</span></div>
  </div>`;
}

// ── Funil builder ──
function buildFunil(steps) {
  const max = steps[0]?.valor || 1;
  return `<div class="funnel">${steps.map((s, i) => {
    const w = Math.round((s.valor / max) * 100);
    const pct = i === 0 ? 100 : Math.round((s.valor / steps[i-1].valor) * 100);
    const opacity = 1 - (i * 0.16);
    const conn = i < steps.length - 1
      ? `<div class="funnel-connector"><div class="funnel-connector-line"></div><span class="funnel-connector-pct">${pct}% chegaram</span></div>` : '';
    return `
      <div class="funnel-step">
        <div class="funnel-meta">
          <div class="funnel-meta-num">${fNum(s.valor)}</div>
          <div class="funnel-meta-label">${s.label}</div>
        </div>
        <div class="funnel-bar-wrap">
          <div class="funnel-bar" style="width:${w}%;background:rgba(91,124,255,${opacity});">
            <span class="funnel-bar-label">${s.label}</span>
            <span class="funnel-bar-pct">${i===0?'100':pct}%</span>
          </div>
        </div>
      </div>${conn}`;
  }).join('')}</div>`;
}

// ── Chart helpers ──
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function lineChart(id, labels, datasets) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type:'line',
    data:{ labels, datasets: datasets.map((d,i) => ({
      label:d.label, data:d.data,
      borderColor:d.color||[ACC,G1,G2][i%3],
      backgroundColor: `rgba(${hexToRgb(d.color||ACC)},0.06)`,
      tension:0.4, fill:true, borderWidth:1.5, pointRadius:0
    }))},
    options:{ ...baseOpts(), plugins:{legend:{labels:{color:'#9898a8',usePointStyle:true,pointStyle:'circle',padding:14}}} }
  });
}

function barChart(id, labels, data, color=ACC, horizontal=false) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type:'bar',
    data:{ labels, datasets:[{data,backgroundColor:color,borderRadius:3}]},
    options:{ ...baseOpts(), ...(horizontal?{indexAxis:'y'}:{}),
      plugins:{legend:{display:false}},
      scales: horizontal
        ? {x:{grid:{color:'rgba(255,255,255,.03)'},ticks:{color:'#5a5a6a'}},y:{grid:{display:false},ticks:{color:'#9898a8'}}}
        : undefined
    }
  });
}

function donutChart(id, labels, data, colors) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, {
    type:'doughnut',
    data:{ labels, datasets:[{data, backgroundColor:colors||[ACC,G1,G2,'#555','#444'], borderWidth:0}]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'72%',
      plugins:{ legend:{ position:'right', labels:{color:'#9898a8',padding:12,font:{size:11},usePointStyle:true,pointStyle:'circle'} } }
    }
  });
}

function baseOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false} },
    scales:{
      x:{ grid:{color:'rgba(255,255,255,.03)'}, ticks:{color:'#5a5a6a'} },
      y:{ grid:{color:'rgba(255,255,255,.03)'}, ticks:{color:'#5a5a6a'} }
    }
  };
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '91,124,255';
}

// ══════════════════════════════
// PAGE LOADERS
// ══════════════════════════════

// ── RESUMO ──
async function loadResumo() {
  const f = getFilters();
  const [kpis, diario, horario, semana, whStatus] = await Promise.all([
    api(`dashboard/kpis?${qs(f)}`),
    api(`dashboard/grafico-diario?${qs(f)}`),
    api(`dashboard/por-horario?${qs(f)}`),
    api(`dashboard/por-dia-semana?${qs(f)}`),
    api(`dashboard/webhooks-status`),
  ]);
  if (!kpis) return;

  // KPIs
  document.getElementById('kpi-resumo').innerHTML =
    buildKPI('Faturamento Bruto',   fBRL(kpis.faturamento_bruto),   12, 'vs. período anterior', 'fas fa-circle-dollar-to-slot') +
    buildKPI('Total Vendas',         fNum(kpis.total_vendas),         8,  'vs. período anterior', 'fas fa-check-circle') +
    buildKPI('Ticket Médio',         fBRL(kpis.ticket_medio),        null,'—',                    'fas fa-tag') +
    buildKPI('Reembolsos',           fBRL(kpis.reembolsos_valor),    null,`${kpis.reembolsos_qtd} pedidos`, 'fas fa-rotate-left');

  // Gráfico diário
  if (diario) {
    const plataformas = ['kiwify','ticto','lastlink'];
    const labels = [...new Set(diario.map(d=>d.dia))].sort();
    const cores = [ACC, G1, G2];
    lineChart('c-fat-diario', labels.map(d=>d.substring(5).replace('-','/')),
      plataformas.map((p,i) => ({
        label: p.charAt(0).toUpperCase()+p.slice(1),
        color: cores[i],
        data: labels.map(dia => diario.find(d=>d.dia===dia&&d.plataforma===p)?.faturamento || 0)
      }))
    );
  }

  // Donut plataformas
  if (kpis.por_plataforma?.length) {
    donutChart('c-plat-donut',
      kpis.por_plataforma.map(p=>p.plataforma),
      kpis.por_plataforma.map(p=>p.faturamento),
      [ACC, G1, G2]
    );
    const total = kpis.por_plataforma.reduce((s,p)=>s+p.faturamento,0)||1;
    document.getElementById('plat-lista').innerHTML = kpis.por_plataforma.map(p => {
      const pct = Math.round(p.faturamento/total*100);
      return `<div class="src-row">
        <div class="src-icon" style="font-size:10px;font-weight:700;color:var(--acc);">${p.plataforma.substring(0,3).toUpperCase()}</div>
        <div class="src-info"><div class="src-name">${p.plataforma}</div>
          <div class="src-bar-track"><div class="src-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div><div class="src-val">${fBRL(p.faturamento)}</div><div style="font-size:11px;color:var(--t2);text-align:right;">${pct}%</div></div>
      </div>`;
    }).join('');
  }

  // Horário
  if (horario) barChart('c-horario', horario.map(h=>h.hora+'h'), horario.map(h=>h.vendas), ACC);

  // Semana
  if (semana) barChart('c-semana', semana.map(s=>s.dia), semana.map(s=>s.vendas), ACC);

  // Webhooks
  if (whStatus) {
    document.getElementById('wh-status-list').innerHTML = whStatus.map(w => {
      const mins = w.ultimo_evento
        ? Math.floor((Date.now() - new Date(w.ultimo_evento))/60000)
        : null;
      const dotCls = mins === null ? 'off' : mins < 30 ? 'on' : mins < 120 ? 'warn' : 'off';
      const tempo = mins === null ? 'Nenhum evento' : mins < 1 ? 'Agora' : `${mins} min atrás`;
      return `<div class="wh-item">
        <div class="wh-dot ${dotCls}"></div>
        <div style="flex:1"><div style="font-size:12.5px;font-weight:500;">${w.plataforma.charAt(0).toUpperCase()+w.plataforma.slice(1)}</div>
        <div style="font-size:11px;color:var(--t2);">${tempo}</div></div>
        <div style="font-family:'Geist Mono',monospace;font-size:12px;color:var(--up);">${fNum(w.total_30d)}</div>
      </div>`;
    }).join('');
  }
}

// ── META / GOOGLE / TIKTOK (reutiliza funil) ──
async function loadPlatforma(plataforma) {
  const f = { ...getFilters(), plataforma };
  const [kpis, funil, diario] = await Promise.all([
    api(`dashboard/kpis?${qs(f)}`),
    api(`dashboard/funil?${qs(f)}`),
    api(`dashboard/grafico-diario?${qs(f)}`),
  ]);
  if (!kpis) return { kpis:null, funil:null, diario:null };
  return { kpis, funil, diario };
}

function renderKPIs6(containerId, kpis) {
  if (!kpis) return;
  document.getElementById(containerId).innerHTML =
    buildKPI('Fat. Bruto',   fBRL(kpis.faturamento_bruto),   14,  '30d') +
    buildKPI('Faturamento Líq.', fBRL(kpis.faturamento_liquido), null,'30d') +
    buildKPI('Total Vendas',  fNum(kpis.total_vendas),         8,   '30d') +
    buildKPI('Ticket Médio',  fBRL(kpis.ticket_medio),        null, '30d') +
    buildKPI('Reembolsos',    fBRL(kpis.reembolsos_valor),    null, `${kpis.reembolsos_qtd} pedidos`) +
    buildKPI('Métod. Pgto.',  kpis.por_metodo_pagamento?.[0]?.metodo||'—', null,'mais usado');
}

async function loadMeta() {
  const { kpis, funil, diario } = await loadPlatforma('kiwify'); // usa kiwify como proxy Meta
  renderKPIs6('kpi-meta', kpis);

  if (funil) {
    document.getElementById('funil-meta').innerHTML = buildFunil([
      { label:'Cliques no Anúncio', valor: funil.cliques },
      { label:'Visitas na Página',  valor: funil.visitas },
      { label:'Initiate Checkout',  valor: funil.init_checkout },
      { label:'Vendas Iniciadas',   valor: funil.vendas_iniciadas },
      { label:'Vendas Aprovadas',   valor: funil.vendas_aprovadas },
    ]);
  }

  if (kpis?.por_metodo_pagamento) {
    donutChart('c-pgto-meta',
      kpis.por_metodo_pagamento.map(m=>m.metodo||'outro'),
      kpis.por_metodo_pagamento.map(m=>m.qtd),
      [ACC, G1, G2]
    );
  }

  document.getElementById('pos-meta').innerHTML = `<div class="src-list">
    <div class="src-row"><div class="src-icon"><i class="fas fa-rectangle-vertical"></i></div><div class="src-info"><div class="src-name">Stories</div><div class="src-bar-track"><div class="src-bar-fill" style="width:72%"></div></div></div><div class="src-val">392</div></div>
    <div class="src-row"><div class="src-icon"><i class="fas fa-image"></i></div><div class="src-info"><div class="src-name">Feed</div><div class="src-bar-track"><div class="src-bar-fill" style="width:54%"></div></div></div><div class="src-val">294</div></div>
    <div class="src-row"><div class="src-icon"><i class="fas fa-film"></i></div><div class="src-info"><div class="src-name">Reels</div><div class="src-bar-track"><div class="src-bar-fill" style="width:40%"></div></div></div><div class="src-val">218</div></div>
  </div>`;

  if (diario) {
    const labels = [...new Set(diario.map(d=>d.dia))].sort().map(d=>d.substring(5).replace('-','/'));
    lineChart('c-gasto-fat-meta', labels, [
      { label:'Faturamento', data: diario.filter(d=>d.plataforma==='kiwify').map(d=>d.faturamento), color:ACC },
    ]);
  }

  const porProd = await api(`dashboard/por-produto?plataforma=kiwify&${qs(getFilters())}`);
  if (porProd?.length) barChart('c-prod-meta', porProd.map(p=>p.produto), porProd.map(p=>p.faturamento), ACC, true);
}

async function loadGoogle() {
  const { kpis, funil, diario } = await loadPlatforma('ticto');
  renderKPIs6('kpi-google', kpis);
  if (funil) document.getElementById('funil-google').innerHTML = buildFunil([
    { label:'Cliques',          valor: funil.cliques },
    { label:'Visitas',          valor: funil.visitas },
    { label:'Init. Checkout',   valor: funil.init_checkout },
    { label:'Vendas Aprovadas', valor: funil.vendas_aprovadas },
  ]);
  if (diario) {
    const labels = [...new Set(diario.map(d=>d.dia))].sort().map(d=>d.substring(5).replace('-','/'));
    lineChart('c-google-evol', labels, [
      { label:'Faturamento', data: diario.filter(d=>d.plataforma==='ticto').map(d=>d.faturamento), color:ACC },
    ]);
  }
}

async function loadTiktok() {
  const { kpis, funil } = await loadPlatforma('lastlink');
  renderKPIs6('kpi-tiktok', kpis);
  if (funil) document.getElementById('funil-tiktok').innerHTML = buildFunil([
    { label:'Cliques',          valor: funil.cliques },
    { label:'Visitas',          valor: funil.visitas },
    { label:'Vendas Aprovadas', valor: funil.vendas_aprovadas },
  ]);
  document.getElementById('pos-tiktok').innerHTML = `<div class="src-list" style="padding-top:4px;">
    <div class="src-row"><div class="src-icon"><i class="fas fa-film"></i></div><div class="src-info"><div class="src-name">Feed / ForYou</div><div class="src-bar-track"><div class="src-bar-fill" style="width:78%"></div></div></div><div class="src-val">248</div></div>
    <div class="src-row"><div class="src-icon"><i class="fas fa-link"></i></div><div class="src-info"><div class="src-name">Bio Link</div><div class="src-bar-track"><div class="src-bar-fill" style="width:42%"></div></div></div><div class="src-val">132</div></div>
    <div class="src-row"><div class="src-icon"><i class="fas fa-circle-play"></i></div><div class="src-info"><div class="src-name">Lives</div><div class="src-bar-track"><div class="src-bar-fill" style="width:18%"></div></div></div><div class="src-val">60</div></div>
  </div>`;
}

// ── UTMs ──
async function loadUTMs() {
  const f = getFilters();
  const dados = await api(`dashboard/por-src?${qs(f)}`);
  if (!dados) return;

  document.getElementById('kpi-utms').innerHTML =
    buildKPI('Cliques Totais', '49.1k',  18, '30d') +
    buildKPI('Links Ativos',  '27',      null,'ativos') +
    buildKPI('CPA',           'R$362',   -4, '30d') +
    buildKPI('Tempo Conv.',   '4h 22m',  null,'média');

  const rows = dados.map(d => `<tr>
    <td class="bold">${d.produto}</td>
    <td><code>${d.src}</code></td>
    <td>${d.rede||'—'}</td>
    <td class="mono">${fNum(d.vendas)}</td>
    <td class="mono bold">${fBRL(d.faturamento)}</td>
  </tr>`).join('');

  document.getElementById('utms-table-wrap').innerHTML = `
    <table class="tbl">
      <thead><tr><th>Produto</th><th>SRC</th><th>Rede</th><th>Conv.</th><th>Receita</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--t2);padding:24px;">Nenhuma venda com UTM registrada ainda.</td></tr>'}</tbody>
    </table>`;
}

function filterUTMTable() {
  const q = document.getElementById('utm-search')?.value.toLowerCase();
  document.querySelectorAll('#utms-table-wrap tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── COMERCIAL ──
async function loadComercial() {
  const f = getFilters();
  const data = await api(`comercial/ranking?${qs(f)}`);
  if (!data) return;

  const rank = data.ranking;
  const totalVendas  = rank.reduce((s,v)=>s+(v.total_conversoes||0),0);
  const totalFat     = rank.reduce((s,v)=>s+(v.faturamento||0),0);
  const melhor       = rank[0];

  document.getElementById('kpi-comercial').innerHTML =
    buildKPI('Total Conversões', fNum(totalVendas),   8,  'período') +
    buildKPI('Faturamento',      fBRL(totalFat),      11, 'período') +
    buildKPI('Ticket Médio',     totalVendas ? fBRL(totalFat/totalVendas) : '—', null,'—') +
    buildKPI('Melhor Vendedor',  melhor?.nome||'—',   null, melhor?fBRL(melhor.faturamento):'') +
    buildKPI('Total Leads',      fNum(rank.reduce((s,v)=>s+(v.total_leads||0),0)), 14,'período');

  document.getElementById('velocidade-vendas').textContent =
    `Velocidade atual: ${(totalVendas/30/24).toFixed(1)} conversões/hora`;

  // Ranking table
  const rankRows = rank.map((v,i) => {
    const cls = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-n';
    const trend = Math.random()>0.4
      ? '<i class="fas fa-arrow-trend-up trend-up"></i>'
      : '<i class="fas fa-arrow-trend-down trend-dn"></i>';
    const tagCls = v.taxa_conversao>=15?'tag-up':v.taxa_conversao>=8?'tag-acc':'tag-nt';
    return `<tr>
      <td><span class="rank-badge ${cls}">${i+1}</span></td>
      <td class="bold">${v.nome}</td>
      <td class="mono">${fNum(v.total_conversoes)}</td>
      <td class="mono bold">${fBRL(v.faturamento)}</td>
      <td class="mono">${v.total_conversoes&&v.faturamento ? fBRL(v.faturamento/v.total_conversoes) : '—'}</td>
      <td class="mono">${fNum(v.total_leads)}</td>
      <td><span class="tag ${tagCls}">${v.taxa_conversao}%</span></td>
      <td>${trend}</td>
    </tr>`;
  }).join('');

  document.getElementById('ranking-wrap').innerHTML = `
    <table class="tbl">
      <thead><tr><th>#</th><th>Vendedor</th><th>Conversões</th><th>Faturamento</th><th>Ticket Médio</th><th>Leads</th><th>Taxa Conv.</th><th>Tend.</th></tr></thead>
      <tbody>${rankRows||'<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--t2);">Nenhum dado no período.</td></tr>'}</tbody>
    </table>`;

  // Evolução
  lineChart('c-vend-evol', DAYS, rank.slice(0,3).map((v,i) => ({
    label: v.nome.split(' ')[0],
    color: [ACC,G1,G2][i],
    data: Array.from({length:15}, () => Math.floor(Math.random()*(v.total_conversoes||5)/15))
  })));

  // Pizza plataformas
  const platData = await api(`dashboard/kpis?${qs(f)}`);
  if (platData?.por_plataforma?.length) {
    donutChart('c-plat-pie-com',
      platData.por_plataforma.map(p=>p.plataforma),
      platData.por_plataforma.map(p=>p.faturamento),
    );
  }

  // Heatmap
  buildHeatmap('heatmap-com', rank.map(v=>v.nome.split(' ')[0]));
}

function buildHeatmap(containerId, labels) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  const hours = Array.from({length:24},(_,i)=>i);
  const axisX = document.createElement('div');
  axisX.className = 'hm-axis-x';
  hours.forEach(h=>{const s=document.createElement('span');s.textContent=h+'h';s.style.flex='1';axisX.appendChild(s);});
  wrap.appendChild(axisX);
  labels.forEach(nome=>{
    const row=document.createElement('div');row.className='hm-row';
    const lbl=document.createElement('div');lbl.className='hm-label';lbl.textContent=nome;row.appendChild(lbl);
    hours.forEach(()=>{
      const v=Math.random();const cell=document.createElement('div');cell.className='hm-cell';cell.style.flex='1';
      if(v>.75)cell.style.background=`rgba(91,124,255,${(v*.8+.1).toFixed(2)})`;
      else if(v>.4)cell.style.background=`rgba(91,124,255,${(v*.3+.05).toFixed(2)})`;
      else cell.style.background='var(--bg-4)';
      row.appendChild(cell);
    });
    wrap.appendChild(row);
  });
}

// ── REGISTROS ──
async function loadRegistros() {
  const f = getFilters();
  const dados = await api(`registros?${qs({vendedor_id:f.vendedor_id, produto_id:f.produto_id})}`);
  if (!dados) return;
  const canais = {whatsapp_organico:'WhatsApp',meta_ads:'Meta Ads',google_ads:'Google Ads',tiktok_ads:'TikTok',instagram_organico:'Instagram',email:'E-mail',indicacao:'Indicação',outro:'Outro'};
  const rows = dados.map(r=>{
    const taxa = r.qtd_leads>0?((r.qtd_conversoes/r.qtd_leads)*100).toFixed(1):0;
    const cls = taxa>=15?'tag-up':taxa>=8?'tag-acc':'tag-nt';
    return `<tr>
      <td class="mono">${r.data_registro?.substring(5).replace('-','/')}</td>
      <td class="bold">${r.vendedor_nome||'—'}</td>
      <td>${r.produto_nome||'—'}</td>
      <td>${canais[r.canal]||r.canal||'—'}</td>
      <td class="mono">${r.qtd_leads}</td>
      <td class="mono">${r.qtd_conversoes}</td>
      <td><span class="tag ${cls}">${taxa}%</span></td>
      <td class="mono bold">${fBRL(r.valor_total)}</td>
    </tr>`;
  }).join('');
  document.getElementById('registros-wrap').innerHTML=`
    <table class="tbl">
      <thead><tr><th>Data</th><th>Vendedor</th><th>Produto</th><th>Canal</th><th>Leads</th><th>Conv.</th><th>Taxa</th><th>Valor</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--t2);">Nenhum registro.</td></tr>'}</tbody>
    </table>`;
}

// ── FINANCEIRO ──
async function loadFinanceiro() {
  const f = getFilters();
  const kpis = await api(`dashboard/kpis?${qs(f)}`);
  if (!kpis) return;

  document.getElementById('kpi-fin').innerHTML =
    buildKPI('Fat. Bruto',    fBRL(kpis.faturamento_bruto),   12,'') +
    buildKPI('Fat. Líquido',  fBRL(kpis.faturamento_liquido), 9, '') +
    buildKPI('Lucro Final',   fBRL(kpis.faturamento_liquido*0.64||0), 7,'estimado') +
    buildKPI('Total Taxas',   fBRL(kpis.faturamento_bruto*0.1||0), null,'~10%') +
    buildKPI('Reembolsos',    fBRL(kpis.reembolsos_valor),   null,`${kpis.reembolsos_qtd} pedidos`);

  document.getElementById('kpi-fin2').innerHTML =
    buildKPI('Gasto Ads',    fBRL(kpis.faturamento_bruto*0.26||0),  null,'estimado') +
    buildKPI('Impostos',     fBRL(kpis.faturamento_bruto*0.08||0),  null,'~8% bruto') +
    buildKPI('Pend. Pgto.',  fBRL(kpis.faturamento_bruto*0.037||0), null,'pendente') +
    buildKPI('Projeção Mês', fBRL(kpis.faturamento_bruto*1.2||0),   20, 'tendência');

  const diario = await api(`dashboard/grafico-diario?${qs(f)}`);
  if (diario) {
    const labels = [...new Set(diario.map(d=>d.dia))].sort().map(d=>d.substring(5).replace('-','/'));
    const bruto = labels.map(dia => diario.filter(d=>d.dia===dia).reduce((s,d)=>s+d.faturamento,0));
    lineChart('c-fin-evol', labels, [
      {label:'Bruto', data:bruto, color:ACC},
      {label:'Líquido', data:bruto.map(v=>v*0.72), color:G1},
    ]);
  }

  const porProd = await api(`dashboard/por-produto?${qs(f)}`);
  if (porProd?.length) donutChart('c-fin-prod', porProd.map(p=>p.produto), porProd.map(p=>p.faturamento));

  destroyChart('c-fin-ads');
  const elAds = document.getElementById('c-fin-ads');
  if (elAds) {
    charts['c-fin-ads'] = new Chart(elAds,{type:'bar',data:{labels:DAYS,datasets:[
      {label:'Meta',   data:Array.from({length:15},()=>Math.floor(Math.random()*12+4)),backgroundColor:ACC,borderRadius:2,stack:'s'},
      {label:'Google', data:Array.from({length:15},()=>Math.floor(Math.random()*8+2)), backgroundColor:G1, borderRadius:2,stack:'s'},
      {label:'TikTok', data:Array.from({length:15},()=>Math.floor(Math.random()*6+2)), backgroundColor:G2, borderRadius:2,stack:'s'},
    ]},options:{...baseOpts(true),plugins:{legend:{labels:{color:'#9898a8',usePointStyle:true,pointStyle:'circle',padding:12}}}}});
  }

  barChart('c-fin-roi',  ['Meta','Google','TikTok','E-mail','Orgânico'],[4.2,3.7,3.1,5.8,4.6], ACC);
  destroyChart('c-fin-reimb');
  const elRe=document.getElementById('c-fin-reimb');
  if(elRe)charts['c-fin-reimb']=new Chart(elRe,{type:'bar',data:{labels:DAYS,datasets:[{data:Array.from({length:15},()=>Math.floor(Math.random()*8+1)),backgroundColor:DN,borderRadius:3}]},options:baseOpts()});

  // Waterfall
  const wrap = document.getElementById('waterfall-wrap');
  if (wrap) {
    const bruto = kpis.faturamento_bruto||0;
    const items = [
      {l:'Fat. Bruto',   v:bruto,            c:ACC},
      {l:'(-) Taxas',    v:-(bruto*.1),       c:DN},
      {l:'(-) Impostos', v:-(bruto*.08),      c:DN},
      {l:'(-) Reimb.',   v:-(kpis.reembolsos_valor||0),c:DN},
      {l:'Fat. Líquido', v:kpis.faturamento_liquido||bruto*.82, c:UP},
      {l:'(-) Ads',      v:-(bruto*.26),      c:DN},
      {l:'Lucro Final',  v:(kpis.faturamento_liquido||bruto*.82)-(bruto*.26), c:UP},
    ];
    const max = bruto || 1;
    wrap.innerHTML = `<div style="display:flex;align-items:flex-end;justify-content:space-around;height:160px;padding:0 10px;gap:6px;">
      ${items.map(item=>{
        const h = Math.max(Math.abs(item.v)/max*140,6);
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;">
          <div style="font-size:10px;font-family:'Geist Mono',monospace;color:var(--t0);white-space:nowrap;">${item.v>=0?'':'-'}${fBRL(Math.abs(item.v))}</div>
          <div style="width:100%;height:${h}px;background:${item.c};border-radius:3px 3px 0 0;opacity:.85;"></div>
          <div style="font-size:9.5px;color:var(--t2);text-align:center;white-space:nowrap;">${item.l}</div>
        </div>`;
      }).join('')}
    </div>`;
  }
}

// ── PRODUTOS ──
async function loadProdutos() {
  const produtos = await api('produtos');
  if (!produtos) return;

  const rows = produtos.map(p=>`<tr>
    <td class="bold">${p.nome_dash}</td>
    <td>${p.nome_completo}</td>
    <td><span class="tag tag-acc">${p.categoria}</span></td>
    <td>${p.codigo_kiwify ? `<code>${p.codigo_kiwify}</code>` : '<span style="color:var(--t2)">—</span>'}</td>
    <td>${p.codigo_ticto  ? `<code>${p.codigo_ticto}</code>`  : '<span style="color:var(--t2)">—</span>'}</td>
    <td>${p.codigo_lastlink ? `<code>${p.codigo_lastlink}</code>` : '<span style="color:var(--t2)">—</span>'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="editProduto(${p.id})"><i class="fas fa-pencil"></i></button></td>
  </tr>`).join('');

  document.getElementById('produtos-table-wrap').innerHTML=`
    <table class="tbl">
      <thead><tr><th>Nome no Dash</th><th>Nome Completo</th><th>Tipo</th><th>Kiwify</th><th>Ticto</th><th>Lastlink</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--t2);">Nenhum produto cadastrado.</td></tr>'}</tbody>
    </table>`;

  // Docs webhooks
  document.getElementById('webhook-docs').innerHTML = `
    <div class="card">
      <div class="card-h" style="border-bottom-color:rgba(62,207,142,.2);"><span class="card-title" style="color:var(--up);">Kiwify</span><span class="tag tag-up">POST</span></div>
      <div class="card-b" style="font-size:12px;">
        <p style="color:var(--t2);margin-bottom:10px;line-height:1.6;">Evento: <code>order_approved</code>. O campo que identifica o produto:</p>
        <div style="background:var(--bg-3);border:1px solid var(--b0);border-radius:6px;padding:10px;font-family:'Geist Mono',monospace;font-size:10.5px;line-height:1.9;margin-bottom:10px;">
          <span style="color:var(--t2)">// data.product.id</span><br>
          { "event": "order_approved",<br>
          &nbsp;&nbsp;"data": { "product": {<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--dn);">"id"</span>: <span style="color:var(--up);">"prod_ttshop01"</span> <span style="color:var(--t2);">← este</span><br>
          &nbsp;&nbsp;}, "utm_source": "...", "order_value": 997.00 }}
        </div>
        <div style="padding:8px 10px;background:var(--upd);border-radius:5px;font-size:11px;color:var(--up);">Lê: <code>data.product.id</code></div>
      </div>
    </div>
    <div class="card">
      <div class="card-h" style="border-bottom-color:rgba(240,96,96,.2);"><span class="card-title" style="color:var(--dn);">Ticto</span><span class="tag tag-dn">POST</span></div>
      <div class="card-b" style="font-size:12px;">
        <p style="color:var(--t2);margin-bottom:10px;line-height:1.6;">Evento: <code>purchase.approved</code>. O campo que identifica o produto:</p>
        <div style="background:var(--bg-3);border:1px solid var(--b0);border-radius:6px;padding:10px;font-family:'Geist Mono',monospace;font-size:10.5px;line-height:1.9;margin-bottom:10px;">
          <span style="color:var(--t2)">// venda.produto_id</span><br>
          { "tipo": "purchase.approved",<br>
          &nbsp;&nbsp;"venda": {<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--dn);">"produto_id"</span>: <span style="color:var(--yn);">11204</span> <span style="color:var(--t2);">← este</span><br>
          &nbsp;&nbsp;&nbsp;&nbsp;"valor": 997.00, "utm_source": "..." }}
        </div>
        <div style="padding:8px 10px;background:var(--dnd);border-radius:5px;font-size:11px;color:var(--dn);">Lê: <code>venda.produto_id</code></div>
      </div>
    </div>
    <div class="card">
      <div class="card-h" style="border-bottom-color:rgba(167,139,250,.2);"><span class="card-title" style="color:#a78bfa;">Lastlink</span><span class="tag tag-acc">POST</span></div>
      <div class="card-b" style="font-size:12px;">
        <p style="color:var(--t2);margin-bottom:10px;line-height:1.6;">Evento: <code>sale_approved</code>. O campo que identifica o produto:</p>
        <div style="background:var(--bg-3);border:1px solid var(--b0);border-radius:6px;padding:10px;font-family:'Geist Mono',monospace;font-size:10.5px;line-height:1.9;margin-bottom:10px;">
          <span style="color:var(--t2)">// sale.product_id</span><br>
          { "event_type": "sale_approved",<br>
          &nbsp;&nbsp;"sale": {<br>
          &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#a78bfa;">"product_id"</span>: <span style="color:var(--up);">"LL-44201"</span> <span style="color:var(--t2);">← este</span><br>
          &nbsp;&nbsp;&nbsp;&nbsp;"amount": 99700 <span style="color:var(--t2);">// centavos ÷ 100</span> }}
        </div>
        <div style="padding:8px 10px;background:rgba(167,139,250,.08);border-radius:5px;font-size:11px;color:#a78bfa;">Lê: <code>sale.product_id</code> — valor em centavos</div>
      </div>
    </div>`;
}

// ── INTEGRAÇÕES ──
async function loadInteg() {
  const status = await api('dashboard/webhooks-status');
  const intgs = [
    { name:'Kiwify',  color:'var(--up)',    url:'/api/webhooks/kiwify',  plat:'kiwify'   },
    { name:'Ticto',   color:'var(--dn)',    url:'/api/webhooks/ticto',   plat:'ticto'    },
    { name:'Lastlink',color:'#a78bfa',      url:'/api/webhooks/lastlink',plat:'lastlink' },
    { name:'UTMfy',   color:'var(--yn)',    url:'/api/webhooks/utmfy',   plat:null       },
  ];
  document.getElementById('integ-cards').innerHTML = intgs.map(i => {
    const s = status?.find(w=>w.plataforma===i.plat);
    return `<div class="card">
      <div class="card-h"><span class="card-title" style="color:${i.color};">${i.name}</span><span class="tag tag-up">Ativo</span></div>
      <div class="card-b">
        <div style="margin-bottom:12px;"><div style="font-size:10.5px;color:var(--t2);margin-bottom:5px;">WEBHOOK URL — configure na plataforma</div>
          <code style="display:block;padding:8px;font-size:11px;">${location.origin}${i.url}</code></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div><div style="font-size:10.5px;color:var(--t2);">Eventos 30d</div><div style="font-size:16px;font-weight:700;font-family:'Geist Mono',monospace;color:var(--up);">${s?fNum(s.total_30d):'—'}</div></div>
          <div style="text-align:right;"><div style="font-size:10.5px;color:var(--t2);">Último evento</div><div style="font-size:12px;font-family:'Geist Mono',monospace;">${s?.ultimo_evento?new Date(s.ultimo_evento).toLocaleString('pt-BR'):'Nenhum'}</div></div>
        </div>
        <button class="btn btn-ghost" style="width:100%;justify-content:center;font-size:11.5px;" onclick="testWebhook('${i.plat}')"><i class="fas fa-rotate"></i> Testar</button>
      </div>
    </div>`;
  }).join('');
}

async function testWebhook(plat) {
  if (!plat) { toast('Webhook UTMfy não possui endpoint de teste.','err'); return; }
  const payload = plat==='kiwify'
    ? {event:'order_approved',data:{product:{id:'test'},order_value:997,payment:{payment_method:'credit_card'}}}
    : plat==='ticto'
    ? {tipo:'purchase.approved',venda:{produto_id:'test',valor:997}}
    : {event_type:'sale_approved',sale:{product_id:'test',amount:99700}};
  const r = await fetch(`/api/webhooks/${plat}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d = await r.json();
  toast(d.ok ? `Webhook ${plat} respondeu OK!` : `Erro: ${d.erro}`,'ok');
}

// ── CONFIG ──
async function loadConfig() {
  const [admins, vendedores] = await Promise.all([ api('auth/admins'), api('vendedores') ]);

  if (admins) {
    document.getElementById('admins-list').innerHTML = admins.map(a=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b0);">
        <div class="u-av">${a.nome.substring(0,2).toUpperCase()}</div>
        <div style="flex:1;"><div style="font-size:12.5px;font-weight:500;">${a.nome}</div><div style="font-size:11px;color:var(--t2);">${a.email}</div></div>
        <span class="tag ${a.ativo?'tag-up':'tag-nt'}">${a.ativo?'Ativo':'Inativo'}</span>
      </div>`).join('');
  }

  if (vendedores) {
    document.getElementById('vendedores-list').innerHTML = vendedores.map(v=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b0);">
        <div class="u-av">${v.nome.substring(0,2).toUpperCase()}</div>
        <div style="flex:1;"><div style="font-size:12.5px;font-weight:500;">${v.nome}</div>
          <div style="font-size:11px;color:var(--t2);">site.com/<strong style="color:var(--acc);">${v.slug}</strong></div></div>
        <button class="btn btn-ghost btn-sm" onclick="copyLink('${v.slug}')"><i class="fas fa-copy"></i></button>
      </div>`).join('');
  }
}

function copyLink(slug) {
  navigator.clipboard.writeText(`${location.origin}/${slug}`);
  toast(`Link copiado: /${slug}`,'ok');
}

// ── MODAIS ──
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function closeModalOutside(e, id) { if(e.target.id===id) closeModal(id); }

async function salvarProduto() {
  const body = {
    nome_completo: document.getElementById('ap-nome-completo').value,
    nome_dash:     document.getElementById('ap-nome-dash').value,
    categoria:     document.getElementById('ap-categoria').value,
    codigo_kiwify: document.getElementById('ap-kiwify').value,
    codigo_ticto:  document.getElementById('ap-ticto').value,
    codigo_lastlink:document.getElementById('ap-lastlink').value,
  };
  if (!body.nome_completo || !body.nome_dash) { toast('Nome completo e nome do dashboard são obrigatórios','err'); return; }
  const r = await fetch('/api/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json();
  if (!r.ok) { toast(d.erro||'Erro ao salvar','err'); return; }
  toast('Produto salvo!','ok');
  closeModal('modal-add-produto');
  loadProdutos();
  refreshSelectores();
}

async function salvarVendedor() {
  const body = { nome:document.getElementById('av-nome').value, email:document.getElementById('av-email').value };
  if (!body.nome) { toast('Nome obrigatório','err'); return; }
  const r = await fetch('/api/vendedores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json();
  if (!r.ok) { toast(d.erro||'Erro','err'); return; }
  toast(`Vendedor criado! Link: /${d.slug}`,'ok');
  closeModal('modal-add-vendedor');
  loadConfig();
  refreshSelectores();
}

async function salvarAdmin() {
  const body = { nome:document.getElementById('aa-nome').value, email:document.getElementById('aa-email').value, senha:document.getElementById('aa-senha').value };
  if (!body.nome||!body.email||!body.senha) { toast('Todos os campos são obrigatórios','err'); return; }
  const r = await fetch('/api/auth/admins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json();
  if (!r.ok) { toast(d.erro||'Erro','err'); return; }
  toast('Administrador criado!','ok');
  closeModal('modal-add-admin');
  loadConfig();
}

// ── Logout ──
async function logout() {
  await fetch('/api/auth/logout',{method:'POST'});
  window.location.href = '/login';
}

// ── Toast ──
function toast(msg, tipo='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${tipo}`;
  setTimeout(()=>t.classList.remove('show'),3500);
}

// ── Export CSV ──
async function exportCSV(endpoint) {
  toast('Exportação CSV — em breve','nt');
}

// ── Auto-refresh seletores ──
async function refreshSelectores() {
  const [produtos, vendedores] = await Promise.all([api('produtos'), api('vendedores')]);
  const fProd = document.getElementById('f-produto');
  const fVend = document.getElementById('f-vendedor');
  if (produtos && fProd) {
    fProd.innerHTML = '<option value="">Todos</option>' +
      produtos.map(p=>`<option value="${p.id}">${p.nome_dash}</option>`).join('');
  }
  if (vendedores && fVend) {
    fVend.innerHTML = '<option value="">Todos</option>' +
      vendedores.map(v=>`<option value="${v.id}">${v.nome}</option>`).join('');
  }
}

// ── Carrega admin logado ──
async function loadMe() {
  const data = await api('auth/me');
  if (data?.admin) {
    document.getElementById('u-nome').textContent = data.admin.nome;
    document.getElementById('u-av').textContent = data.admin.nome.substring(0,2).toUpperCase();
  }
}

// ── INIT ──
(async () => {
  await loadMe();
  await refreshSelectores();
  loadResumo();
  updateTimestamp();
  // Auto-refresh a cada 60s
  setInterval(() => { loadPage(currentPage); updateTimestamp(); }, 60000);
})();
