# Node 24 LTS on Debian bookworm (same distro as before, so the Playwright apt deps below
# keep their names). Node 20 is end of life with no fix for CVE-2026-111497; the floating
# major tag picks up security releases on every `docker compose build --pull`.
FROM node:24-bookworm-slim

# pnpm via corepack, at the version pinned in package.json's packageManager field
RUN corepack enable
RUN apt-get update && apt-get install -y wget

# Install required dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies exactly as locked (lockfile v9 needs pnpm 9+)
RUN pnpm install --frozen-lockfile

# Install Playwright browsers
RUN pnpm exec playwright install chromium

# Copy source code
COPY . .

# Build TypeScript code
RUN pnpm build

# Expose port
EXPOSE 6061

# Start the application
CMD ["pnpm", "start"]