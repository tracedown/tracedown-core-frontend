# Multi-stage build: compile the Vue SPA, then serve the static output via nginx.
# Build context is the frontend repo root (see docker-compose.yml: context = ..).
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time configuration. Vite inlines VITE_* into the bundle, so these are
# baked at build — overridable via compose `build.args`. Changing a value
# requires rebuilding the image.
ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=/ws
ARG VITE_WS_MAX_RETRIES=5
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_WS_MAX_RETRIES=$VITE_WS_MAX_RETRIES

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
