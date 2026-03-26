# ==================== STAGE 1: Build ====================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only package files first (no package-lock.json required)
COPY package.json ./

# Install dependencies with npm (works fine with Bun projects)
RUN npm install --ignore-scripts --no-audit --no-fund

# Copy the rest of the source code
COPY . .

# Build the Next.js app (standalone output)
RUN npm run build

# ==================== STAGE 2: Production ====================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy only what is needed for production
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]