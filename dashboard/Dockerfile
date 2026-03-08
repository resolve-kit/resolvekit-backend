FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache git
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
  && git config --global url."https://github.com/".insteadOf git@github.com:

COPY package.json ./
COPY prisma ./prisma
COPY --from=resolvekit_nextjs_sdk /package.json /resolvekit-nextjs-sdk/package.json
COPY --from=resolvekit_nextjs_sdk /package-lock.json /resolvekit-nextjs-sdk/package-lock.json
COPY --from=resolvekit_nextjs_sdk /src /resolvekit-nextjs-sdk/src
COPY --from=resolvekit_nextjs_sdk /tsconfig.json /resolvekit-nextjs-sdk/tsconfig.json
RUN npm --prefix /resolvekit-nextjs-sdk install --legacy-peer-deps --no-audit --no-fund --package-lock=false
RUN npm --prefix /resolvekit-nextjs-sdk run build
RUN npm install --legacy-peer-deps --no-audit --no-fund || true
RUN npm pack /resolvekit-nextjs-sdk --pack-destination /tmp
RUN npm install --legacy-peer-deps --no-audit --no-fund --package-lock=false --no-save /tmp/resolvekit-nextjs-*.tgz
RUN node -e "require.resolve('@resolvekit/nextjs'); require.resolve('@resolvekit/nextjs/client'); require.resolve('@resolvekit/nextjs/react'); require.resolve('@resolvekit/nextjs/server');"

FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_RESOLVEKIT_ENABLED=false
ARG NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_RESOLVEKIT_ENABLED=$NEXT_PUBLIC_RESOLVEKIT_ENABLED
ENV NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL=$NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL
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
