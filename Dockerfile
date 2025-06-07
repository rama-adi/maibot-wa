# use the official Bun image
FROM oven/bun:1
WORKDIR /usr/src/app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source code and data
COPY . .

# Create data directory and set permissions
RUN mkdir -p /usr/src/app/data && \
    chown -R bun:bun /usr/src/app/data && \
    chmod 755 /usr/src/app/data

# Create persistent volume for database files
VOLUME ["/usr/src/app/data"]

# Set user and expose port
USER bun
EXPOSE 3000/tcp

# Start the app with migrations
ENTRYPOINT ["bun", "run", "start.ts"]