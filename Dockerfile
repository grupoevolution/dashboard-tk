FROM node:20-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install --omit=dev

# Copia código
COPY . .

# Cria pasta de dados
RUN mkdir -p /app/data

# Porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/auth/me || exit 1

CMD ["node", "src/server.js"]
