# Grandma's Wi-Fi Password: one container that serves the API and the built web client.
# Build:  docker build -t grandma .        Run:  docker run -p 8787:8787 -e GRANDMA_MODE=mock grandma
# On Fly.io see fly.toml; the API key is a secret, never baked into the image.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Install with the lockfile (dev deps too: the server runs TypeScript through tsx).
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN npm ci --include=dev

COPY . .
RUN npm run validate && npm run build

# Run store and turn logs live on a volume (VAR_DIR); see fly.toml [mounts].
ENV API_PORT=8787 VAR_DIR=/data
EXPOSE 8787
CMD ["npm", "start"]
