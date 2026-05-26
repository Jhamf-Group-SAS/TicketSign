FROM node:20-alpine

# Instalar dependencias de Chromium para Puppeteer y tini para gestión de procesos
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tini

# Configurar Puppeteer para usar Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 5000

# Usar tini para gestionar correctamente procesos hijos (evita procesos zombis de Chromium)
ENTRYPOINT ["/sbin/tini", "--"]

# Comando para iniciar la aplicación
CMD ["npm", "start"]
