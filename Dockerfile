# Use Node.js LTS as base image
FROM node:20-slim

# Install pnpm and wget
RUN npm install -g pnpm
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

# Install dependencies
RUN pnpm install

# Install Playwright browsers
RUN pnpm exec playwright install chromium

# Copy source code
COPY . .

# Build TypeScript code
RUN pnpm build

# Make sure static files are copied to dist
RUN mkdir -p dist/static && cp -r src/static/* dist/static/

# Expose port from environment or default to 6061
EXPOSE ${PORT:-6061}

# Start the application
CMD ["pnpm", "start"]