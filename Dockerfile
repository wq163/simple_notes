# ==========================================
# Stage 1: Build Image
# ==========================================
FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package setup
COPY package.json package-lock.json* ./

# Install ONLY production dependencies 
# (Important: This recompiles native bindings like better-sqlite3 for slim Linux)
RUN --mount=type=cache,target=/root/.npm npm ci

RUN npm run build


# ==========================================
# Stage 2: Production Image
# ==========================================
FROM node:24-bookworm-slim

WORKDIR /app

# Copy only the built output and config from the builder stage
COPY config ./config
COPY package.json package-lock.json* ./
COPY --from=builder /app/dist ./dist

RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev


# 安装 gosu 用于在 entrypoint 中安全降权
RUN apt-get update && \
    apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/*


# 将默认配置备份到不会被 volume 挂载覆盖的位置
RUN cp -r /app/config /app/.default-config

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set runtime environment variables
ENV NODE_ENV=production
ENV PORT=3000
# Define the external data directory (mountable as a volume)
ENV DATA_DIR=/app/data

# Ensure the data directory exists
RUN mkdir -p /app/data /app/config

# Expose the API and Web port
EXPOSE 3000

# Use entrypoint to handle permissions, then start Node.js server
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server/app.js"]

