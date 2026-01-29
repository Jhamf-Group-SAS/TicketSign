# Build Stage
FROM node:20-alpine AS build-stage

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production=false

# Copiar código fuente
COPY . .

# Argumento para API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build de la aplicación
RUN npm run build

# Production Stage
FROM nginx:alpine AS production-stage

# Copiar archivos construidos
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copiar configuración de nginx si existe
COPY nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
