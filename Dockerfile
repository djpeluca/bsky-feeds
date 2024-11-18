FROM node:23 as build
WORKDIR /app
COPY ./package.json .
COPY ./yarn.lock .
RUN yarn install
COPY . .
RUN yarn build

FROM node:23 AS deps
WORKDIR /app
COPY --from=build /app/package.json .
COPY --from=build /app/yarn.lock .
RUN yarn install --production

FROM node:23
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=deps /app/package.json .
COPY --from=deps /app/yarn.lock .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src/lexicon ./src/lexicon
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/images ./images
RUN yarn global add tsx

EXPOSE 3000
CMD ["yarn","start"]