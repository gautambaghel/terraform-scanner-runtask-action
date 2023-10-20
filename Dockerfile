FROM node:20

WORKDIR /dist

COPY dist/* /dist

EXPOSE 3000

CMD [ "node", "index.js" ]
