FROM node:20-alpine

WORKDIR /app

# Instalar git si es necesario
RUN apk add --no-cache git

# Copiar archivos del proyecto
COPY package*.json ./
COPY . .

# Argumento de build para la API URL
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Build de la aplicación (Vite usará VITE_API_URL)
RUN npm run build

# Instalar serve globalmente
RUN npm install -g serve

# Exponer puerto
EXPOSE 80

# Servir la aplicación
CMD ["npx", "serve", "-s", "dist", "-l", "80"]

