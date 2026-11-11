# Build the web app and the server bundle
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Run with production dependencies only
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist
COPY firebase-applet-config.json ./
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.cjs"]
