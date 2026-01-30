FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
