FROM node:18-alpine

EXPOSE 8080
WORKDIR /app

# Copy the server files and web directory
COPY server.js .
COPY web/ ./web/

# Change ownership of the app directory to the non-root user
RUN chown -R node:node /app
# Switch to non-root user
USER node

# Start the Node.js server
CMD ["node", "server.js"]
