# Use a lightweight Node image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the default port (3001)
EXPOSE 3001

# Start the Node.js server
CMD ["node", "server.js"]
