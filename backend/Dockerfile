FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/config ./config

RUN mkdir -p uploads && chown node:node uploads

USER node

EXPOSE 5000

CMD ["npm", "start"]
