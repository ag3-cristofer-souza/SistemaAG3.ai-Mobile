# A configuração pública entra quando o container sobe, não no build.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
# SECURITY_REFRESH muda a cada execução do CI, para o `apk upgrade` não sair do cache.
ARG SECURITY_REFRESH=local
RUN echo "security-refresh=${SECURITY_REFRESH}" && apk upgrade --no-cache
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/runtime-config.template.js /opt/ag3/runtime-config.template.js
COPY docker/40-ag3-runtime-config.sh /docker-entrypoint.d/40-ag3-runtime-config.sh
ENV PORT=80
EXPOSE 80
