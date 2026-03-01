FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache git
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
  && git config --global url."https://github.com/".insteadOf git@github.com:

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_PLAYBOOK_ENABLED=false
ARG NEXT_PUBLIC_PLAYBOOK_KEY=
ARG NEXT_PUBLIC_PLAYBOOK_AGENT_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_PLAYBOOK_ENABLED=$NEXT_PUBLIC_PLAYBOOK_ENABLED
ENV NEXT_PUBLIC_PLAYBOOK_KEY=$NEXT_PUBLIC_PLAYBOOK_KEY
ENV NEXT_PUBLIC_PLAYBOOK_AGENT_BASE_URL=$NEXT_PUBLIC_PLAYBOOK_AGENT_BASE_URL
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
