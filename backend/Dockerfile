FROM node:22-alpine

WORKDIR /backend

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js db.js ./

EXPOSE 5000

CMD ["npm", "start"]
