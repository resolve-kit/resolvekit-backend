FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache git
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
  && git config --global url."https://github.com/".insteadOf git@github.com:

COPY package.json ./
COPY prisma ./prisma
COPY --from=resolvekit_web_sdk /package.json /resolvekit-web-sdk/package.json
COPY --from=resolvekit_web_sdk /src /resolvekit-web-sdk/src
COPY --from=resolvekit_web_sdk /vite.config.ts /resolvekit-web-sdk/vite.config.ts
COPY --from=resolvekit_web_sdk /tsconfig.json /resolvekit-web-sdk/tsconfig.json
RUN node -e "const fs=require('fs');const p='/resolvekit-web-sdk/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.dependencies&&j.dependencies['@resolvekit/sdk']){delete j.dependencies['@resolvekit/sdk'];}fs.writeFileSync(p, JSON.stringify(j, null, 2));"
RUN npm --prefix /resolvekit-web-sdk install --no-audit --no-fund --package-lock=false
RUN npm --prefix /resolvekit-web-sdk run build
RUN npm install --no-audit --no-fund || true
RUN npm pack /resolvekit-web-sdk --pack-destination /tmp
RUN npm install --no-audit --no-fund --package-lock=false --no-save /tmp/resolvekit-sdk-*.tgz
RUN node -e "require.resolve('@resolvekit/sdk'); require.resolve('@resolvekit/sdk/react'); require.resolve('@resolvekit/sdk/react-router'); require.resolve('@resolvekit/sdk/starter');"

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
