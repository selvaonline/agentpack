# agentpack demo image — runs one team (manifest chosen via AGENTPACK_MANIFEST)
FROM node:20-slim

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY templates ./templates
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV AGENTPACK_MANIFEST="templates/deal-ma/agentpack.yaml templates/deal-vc/agentpack.yaml templates/deal-procurement/agentpack.yaml templates/equity-research/agentpack.yaml templates/claims-triage/agentpack.yaml templates/support-triage/agentpack.yaml templates/starter/agentpack.yaml"
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node dist/cli.js dev $AGENTPACK_MANIFEST"]
