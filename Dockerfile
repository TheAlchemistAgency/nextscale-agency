# NEXTSCALE AGENCY — production image
FROM node:20-alpine

WORKDIR /app

# install dependencies first so Docker can cache this layer
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# then the source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
# reports survive restarts only if this path is on a mounted volume
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
