# use the official Bun image
FROM oven/bun:1
WORKDIR /usr/src/app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source code and data
COPY . .

# Create persistent volume for database files
VOLUME ["/usr/src/app/data"]

# Set user and expose port
USER bun
EXPOSE 3000/tcp

# Run migrations and start the app
ENTRYPOINT ["sh", "-c", "bun run migrate && bun run index.ts"]