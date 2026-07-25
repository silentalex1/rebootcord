FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p data projects_data minecraft-data

EXPOSE 1000

CMD ["node", "server.js"]