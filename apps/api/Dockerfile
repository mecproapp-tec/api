FROM node:20-bullseye AS builder

RUN apt-get update && apt-get install -y \
    libnss3 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxi6 libxtst6 libxrandr2 libasound2 libatk-bridge2.0-0 \
    libgtk-3-0 libgbm1 libxshmfence1 chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# Garante que os templates .hbs estejam no dist (caso o Nest não os copie)
RUN mkdir -p dist/modules/estimates dist/modules/invoices && \
    cp src/modules/estimates/*.hbs dist/modules/estimates/ 2>/dev/null || true && \
    cp src/modules/invoices/*.hbs dist/modules/invoices/ 2>/dev/null || true

FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
    libnss3 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxi6 libxtst6 libxrandr2 libasound2 libatk-bridge2.0-0 \
    libgtk-3-0 libgbm1 libxshmfence1 chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "start:prod"]