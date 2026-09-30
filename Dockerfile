FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .
RUN cd client && npm run build

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "server/index.js"]
