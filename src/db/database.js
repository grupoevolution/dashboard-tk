const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/dashboard.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    -- Admins
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    -- Vendedores
    CREATE TABLE IF NOT EXISTS vendedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      email TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    -- Produtos
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_completo TEXT NOT NULL,
      nome_dash TEXT NOT NULL,
      categoria TEXT DEFAULT 'Curso',
      codigo_kiwify TEXT,
      codigo_ticto TEXT,
      codigo_lastlink TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    -- Vendas (webhooks das plataformas)
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plataforma TEXT NOT NULL,
      evento TEXT NOT NULL,
      produto_id INTEGER REFERENCES produtos(id),
      produto_codigo_externo TEXT,
      produto_nome_externo TEXT,
      valor_bruto REAL DEFAULT 0,
      valor_liquido REAL DEFAULT 0,
      metodo_pagamento TEXT,
      status TEXT DEFAULT 'aprovado',
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      src TEXT,
      cliente_nome TEXT,
      cliente_email TEXT,
      cliente_doc TEXT,
      payload_raw TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    -- Registros manuais dos vendedores
    CREATE TABLE IF NOT EXISTS registros_vendedor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendedor_id INTEGER NOT NULL REFERENCES vendedores(id),
      produto_id INTEGER REFERENCES produtos(id),
      data_registro TEXT NOT NULL,
      canal TEXT,
      qtd_leads INTEGER DEFAULT 0,
      qtd_conversoes INTEGER DEFAULT 0,
      valor_total REAL DEFAULT 0,
      status TEXT DEFAULT 'concluido',
      observacao TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    -- Gastos com ads (entrada manual ou API)
    CREATE TABLE IF NOT EXISTS gastos_ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fonte TEXT NOT NULL,
      data_gasto TEXT NOT NULL,
      valor REAL NOT NULL,
      campanha TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_vendas_plataforma ON vendas(plataforma);
    CREATE INDEX IF NOT EXISTS idx_vendas_criado_em ON vendas(criado_em);
    CREATE INDEX IF NOT EXISTS idx_vendas_produto ON vendas(produto_id);
    CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status);
    CREATE INDEX IF NOT EXISTS idx_reg_vendedor ON registros_vendedor(vendedor_id);
    CREATE INDEX IF NOT EXISTS idx_reg_data ON registros_vendedor(data_registro);
  `);

  // Seed: admin padrão se não existir nenhum
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get();
  if (adminCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO admins (nome, email, senha_hash) VALUES (?, ?, ?)`)
      .run('Administrador', 'admin@dashboard.com', hash);
    console.log('Admin padrão criado: admin@dashboard.com / admin123');
    console.log('ALTERE A SENHA APÓS O PRIMEIRO LOGIN!');
  }

  // Seed: vendedores exemplo
  const vCount = db.prepare('SELECT COUNT(*) as c FROM vendedores').get();
  if (vCount.c === 0) {
    const vendedores = [
      ['Lucas Moreira', 'lucasmoreira', 'lucas@equipe.com'],
      ['Ana Carolina',  'anacarolina',  'ana@equipe.com'],
      ['Pedro Viana',   'pedroviana',   'pedro@equipe.com'],
    ];
    const ins = db.prepare('INSERT INTO vendedores (nome, slug, email) VALUES (?, ?, ?)');
    vendedores.forEach(v => ins.run(...v));
  }

  // Seed: produtos exemplo
  const pCount = db.prepare('SELECT COUNT(*) as c FROM produtos').get();
  if (pCount.c === 0) {
    const produtos = [
      ['TikTok Shop IA — Curso Completo', 'TT SHOP IA',      'Curso',      'prod_ttshop01', '11204', 'LL-44201'],
      ['Ascensão — Programa Completo',    'ASCENSÃO',         'Mentoria',   'prod_asc002',   '11310', 'LL-44310'],
      ['Comunidade Influencers IA',        'COMUNIDADE IA',   'Assinatura', 'prod_comia03',  '11498', 'LL-44498'],
      ['Acesso Vitalício — Todos os Cursos','Acesso Vitalício','Vitalício', 'prod_vit004',   '11602', 'LL-44602'],
    ];
    const ins = db.prepare('INSERT INTO produtos (nome_completo, nome_dash, categoria, codigo_kiwify, codigo_ticto, codigo_lastlink) VALUES (?,?,?,?,?,?)');
    produtos.forEach(p => ins.run(...p));
  }

  console.log('Banco de dados inicializado.');
}

module.exports = { db, init };
