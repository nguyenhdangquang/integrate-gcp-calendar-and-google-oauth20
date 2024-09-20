FROM node:lts-alpine3.14 as builder

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json yarn.lock ./

COPY prisma ./prisma/

# Install app dependencies
RUN npm ci --prefer-offline --legacy-peer-deps --force
# Generate prisma client, leave out if generating in `postinstall` script
RUN npx prisma generate

COPY . .

RUN npm run build

# Remove development dependencies
RUN npm prune --production --legacy-peer-deps --force


FROM node:lts-alpine3.14 as production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/templates ./templates

EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]
