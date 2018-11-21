FROM mhart/alpine-node:10

COPY . /app
WORKDIR /app
RUN npm install

CMD node index.js