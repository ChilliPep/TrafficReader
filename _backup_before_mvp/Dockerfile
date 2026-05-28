FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
COPY analysis/requirements.txt ./analysis/

RUN cd backend && npm install
RUN apk add --no-cache python3 py3-pip && \
    pip install -r ../analysis/requirements.txt --break-system-packages

COPY . .

EXPOSE 3000

CMD ["npm", "--prefix", "backend", "start"]
