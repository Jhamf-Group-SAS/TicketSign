FROM node:20-alpine

WORKDIR /app

# Instalar git si es necesario
RUN apk add --no-cache git

# Copiar archivos del proyecto
COPY package*.json ./
COPY . .

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Build de la aplicación
RUN npm run build

# Instalar serve globalmente
RUN npm install -g serve

# Exponer puerto
EXPOSE 80

# Servir la aplicación
CMD ["npx", "serve", "-s", "dist", "-l", "80"]
