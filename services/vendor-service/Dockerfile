FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY services/vendor-service/package*.json ./services/vendor-service/
RUN npm install --omit=dev

COPY server/src ./server/src
COPY services/vendor-service/src ./services/vendor-service/src

EXPOSE 5601
CMD ["node", "services/vendor-service/src/server.js"]
