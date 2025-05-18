###################################
# Building file of NextJS Container
# Last version of update: v0.91

###################################
FROM node:22-alpine AS deps
RUN apk add --no-cache g++ make py3-pip libc6-compat
WORKDIR /app
COPY package.json ./
RUN npm install --frozen-lockfile
EXPOSE 3000

FROM node:22-alpine as builder
WORKDIR /app
# Copy dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the full project (including your /src folder)
COPY . .
# Run the build; this will generate the .next folder with the standalone output (ensure next.config.js includes `output: "standalone"`)
RUN npm run build

FROM node:22-alpine as production
# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
# Copy public assets and package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Copy only the necessary build output (the standalone folder and static assets)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Switch to the non-root user
USER nextjs
# Expose the port on which your app will run
EXPOSE 3000
ENV PORT 3000
# Start the Next.js server (the standalone build produces a server.js file)
CMD ["node", "server.js"]
