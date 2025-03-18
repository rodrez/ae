FROM node:20-alpine

WORKDIR /app

# Install pnpm and development dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Use development mode by default
CMD ["pnpm", "dev"]
