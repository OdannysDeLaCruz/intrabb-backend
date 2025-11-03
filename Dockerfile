# ###################
# # PRE-BUILD
# ###################

FROM node:18-alpine As prebuild

WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies (production and development), necesary to access to NestJS CLI (nest build)
RUN npm ci

COPY . .

RUN npx prisma generate

###################
# BUILD FOR PRODUCTION
###################

FROM node:18-alpine As build

WORKDIR /usr/src/app

COPY package*.json ./

COPY --from=prebuild /usr/src/app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN npm run build && ls -laR dist/ || (echo "BUILD FAILED - dist/ no existe" && exit 1)

# Set NODE_ENV environment variable
ENV NODE_ENV production

RUN npm ci --only=production && npm cache clean --force

RUN npx prisma generate

###################
# PRODUCTION
###################

FROM node:18-alpine As production

WORKDIR /usr/src/app

# Copy the bundled code from the build stage to the production image
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

# Start the server using the production build
EXPOSE 3000
CMD [ "node", "dist/src/main.js" ]