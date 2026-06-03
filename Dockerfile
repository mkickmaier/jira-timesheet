# Use an official Node.js runtime as the base image
FROM node:18-slim

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Ensure the uploads directory exists
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 3001

# Define environment variables with default values (can be overridden)
ENV PORT=3001
ENV NODE_ENV=production

# Run the application
CMD [ "node", "server/index.js" ]
