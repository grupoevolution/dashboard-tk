# Dashboard de Performance

Dashboard completo para monitorar vendas, tráfego pago e equipe comercial.

## Stack
- **Backend:** Node.js + Express
- **Banco:** SQLite (better-sqlite3)
- **Frontend:** HTML/CSS/JS puro + Chart.js
- **Deploy:** Docker / EasyPanel

---

## Deploy no EasyPanel

### 1. Suba o código para um repositório GitHub

```bash
git init
git add .
git commit -m "primeiro commit"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

### 2. No EasyPanel

1. Acesse seu EasyPanel → **Criar App**
2. Escolha **GitHub** → selecione o repositório
3. O EasyPanel detecta o `Dockerfile` automaticamente
4. Em **Variáveis de Ambiente**, adicione:

```
PORT=3000
NODE_ENV=production
JWT_SECRET=coloque_uma_string_aleatoria_longa_aqui
JWT_EXPIRES_IN=7d
DB_PATH=/app/data/dashboard.db
```

5. Em **Volumes**, adicione:
   - Caminho no container: `/app/data`
   - (isso persiste o banco SQLite)

6. Em **Porta**, configure: `3000`

7. Clique em **Deploy**

### 3. Primeiro acesso

Após o deploy, acesse o endereço gerado pelo EasyPanel.

**Login padrão:**
- Email: `admin@dashboard.com`
- Senha: `admin123`

**IMPORTANTE:** Troque a senha imediatamente em Configurações → Administradores.

---

## Webhooks — Configure nas plataformas

Após o deploy, configure as URLs de webhook em cada plataforma:

| Plataforma | URL do Webhook |
|------------|----------------|
| Kiwify     | `https://SEU_DOMINIO/api/webhooks/kiwify`  |
| Ticto      | `https://SEU_DOMINIO/api/webhooks/ticto`   |
| Lastlink   | `https://SEU_DOMINIO/api/webhooks/lastlink`|

Você pode testar cada webhook pela página **Integrações** no dashboard.

---

## Páginas dos Vendedores

Cada vendedor acessa sua página própria:

```
https://SEU_DOMINIO/lucasmoreira
https://SEU_DOMINIO/anacarolina
https://SEU_DOMINIO/pedroviana
```

Para adicionar vendedores: **Configurações → Vendedores → Adicionar**.
O link é gerado automaticamente a partir do nome.

---

## Desenvolvimento local

```bash
npm install
cp .env.example .env
# edite o .env com seu JWT_SECRET
node src/server.js
```

Acesse: http://localhost:3000

---

## Estrutura do projeto

```
dashboard/
├── src/
│   ├── server.js          # Servidor principal
│   ├── db/database.js     # SQLite schema + seed
│   ├── middleware/auth.js # JWT middleware
│   └── routes/
│       ├── auth.js        # Login, admins
│       ├── webhooks.js    # Kiwify, Ticto, Lastlink
│       ├── dashboard.js   # KPIs, gráficos, métricas
│       └── crud.js        # Produtos, vendedores, registros
├── public/
│   ├── index.html         # Dashboard principal
│   ├── login.html         # Página de login
│   ├── vendedor.html      # Página do vendedor
│   ├── css/dash.css       # Estilos
│   └── js/dash.js         # Frontend JS
├── Dockerfile
├── docker-compose.yml
└── package.json
```
