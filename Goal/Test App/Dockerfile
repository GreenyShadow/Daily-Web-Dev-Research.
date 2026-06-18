FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy app
COPY . ./

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
