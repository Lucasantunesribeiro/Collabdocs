# Frontend Next.js (output: 'standalone')
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# "npm ci" pode terminar com código 0 sem instalar nada ("Exit handler never called"):
# a verificação falha o build cedo em vez de "next: not found" mais adiante.
RUN npm ci --legacy-peer-deps && test -x node_modules/.bin/next
COPY . .
# Variáveis NEXT_PUBLIC_* são embutidas no bundle em tempo de build.
ARG NEXT_PUBLIC_API_URL=http://localhost:8787/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8787
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
