# Build context: repository root. Versions are pinned so builds are reproducible.
# FROM node:22-alpine AS build
FROM node:22.23.3-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
# Install before setting NODE_ENV=production: npm ci would otherwise skip the devDependencies
# (Vite, TypeScript) that the build needs.
RUN npm ci
ENV NODE_ENV=production
COPY frontend/ ./
RUN npm run build

# FROM nginx:1.29-alpine
FROM nginx:1.29.8-alpine
ENV TZ=UTC
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
