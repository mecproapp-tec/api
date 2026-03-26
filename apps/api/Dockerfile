FROM node:18-bullseye AS builder

# Instalar dependências do Puppeteer
RUN apt-get update && apt-get install -y \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --omit=dev && npm cache clean --force

COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build

# Copiar manualmente os templates (HBS e HTML) para o dist
COPY src/modules/pdf/templates dist/modules/pdf/templates/
COPY src/modules/estimates/*.hbs dist/modules/estimates/
COPY src/modules/invoices/*.hbs dist/modules/invoices/

EXPOSE 3000

CMD ["npm", "run", "start:prod"]