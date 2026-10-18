FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# BLE goes through BlueZ over D-Bus (pure JS), so noble's native HCI/USB addons aren't needed
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY *.ts ./
COPY public ./public
EXPOSE 3033
CMD ["node", "main.ts"]
