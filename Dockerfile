FROM node:20-alpine

RUN apk add --no-cache openjdk21-jre-headless curl bash tar

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p data projects_data minecraft-data

EXPOSE 1000
EXPOSE 25565-25864

CMD ["node", "server.js"]
