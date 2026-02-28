ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.22
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm

COPY rootfs /

WORKDIR /usr/src/app
RUN sed -i 's/\r$//' /etc/services.d/api/run
RUN chmod +x /etc/services.d/api/run
RUN npm install --omit=dev
