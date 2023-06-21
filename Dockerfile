FROM node:20

WORKDIR /usr/src/

ADD . /usr/src/

RUN npm i -g pnpm

WORKDIR /usr/src/bot

RUN pnpm i

CMD ["npm", "run", "dev"]
