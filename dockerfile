# Usa la imagen oficial de Node.js
FROM node:18

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia todos los archivos de tu proyecto al contenedor
COPY . .

# Instala las dependencias definidas en package.json
RUN npm install

# Expone el puerto 3000 (ajústalo si usas otro en server.js)
EXPOSE 3002

# Ejecuta el servidor principal
CMD ["node", "server.js"]
