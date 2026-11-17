# MIL-TRACK as one image: no build step and no dependencies (Node only; SQLite is built into Node 22.13+).
#   docker build -t mil-track .
#   docker run -d -p 3000:3000 -v mil-track-data:/data -e AUTH=1 -e ADMIN_PASSWORD='long-password-123' -e DATA_KEY='long passphrase' mil-track
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY package.json server.js config.js ./
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
