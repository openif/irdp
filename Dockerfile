FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY web/package*.json ./web/
RUN cd web && npm install --omit=dev

# Copy precompiled pkg and web directory directly
COPY pkg/ ./pkg/
COPY web/ ./web/
COPY package.json ./

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "web/server.js"]
