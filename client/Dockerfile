FROM node:22-alpine AS build

WORKDIR /myapp

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:alpine

COPY --from=build /myapp/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
