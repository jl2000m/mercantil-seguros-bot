# Deployment Guide

This guide covers how to deploy the Mercantil Seguros Bot to various hosting platforms.

## Why Not Vercel?

While Vercel is excellent for Next.js applications, this project uses **Playwright** for browser automation, which has specific requirements:

- **Large binaries**: Playwright's Chromium browser is ~100MB+
- **Memory intensive**: Headless browsers need substantial RAM
- **Long execution times**: Quote generation can take 30-60 seconds
- **Cold start issues**: Browser initialization is slow in serverless environments

For these reasons, platforms with container support are better suited.

---

## Recommended: Railway 🚂

**Best option for demos and production use.**

### Free Tier
- $5 credit per month (usually enough for light demo usage)
- No credit card required for free tier
- 500 hours of usage included

### Deployment Steps

1. **Prepare your repository**
   - Ensure your code is pushed to GitHub/GitLab/Bitbucket
   - Make sure `package.json` includes all dependencies

2. **Create a Railway account**
   - Go to https://railway.app
   - Sign up with GitHub (easiest)

3. **Create a new project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

4. **Configure the service**
   - Railway will auto-detect Next.js
   - Add environment variables if needed (check your `.env` file)

5. **Install Playwright browsers**
   
   Create a `railway.json` or add a build command in Railway dashboard:
   
   ```json
   {
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "npm install && npx playwright install --with-deps chromium"
     }
   }
   ```
   
   Or set these build commands in Railway dashboard:
   - **Build Command**: `npm install && npx playwright install --with-deps chromium`
   - **Start Command**: `npm start`

6. **Set environment variables** (if any)
   - Go to your service → Variables tab
   - Add any required environment variables

7. **Deploy**
   - Railway will automatically build and deploy
   - Your app will be available at `https://your-project.railway.app`

### Railway-specific Configuration

You may want to add a `.railway/railway.toml` file:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
```

---

## Alternative: Render 🎨

**Good free tier, but may spin down after inactivity.**

### Free Tier
- 750 hours/month (enough for continuous demo)
- Free SSL
- Spins down after 15 minutes of inactivity

### Deployment Steps

1. **Create a Render account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create a new Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository

3. **Configure the service**
   - **Name**: `mercantil-seguros-bot` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx playwright install --with-deps chromium && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Set environment variables** (if needed)

5. **Deploy**
   - Render will build and deploy automatically
   - First deployment may take 5-10 minutes

### Render-specific Notes

- **Cold starts**: After 15 minutes of inactivity, the service spins down
- **First request**: May take 30-60 seconds after spin-down
- **Playwright setup**: Add to build command as shown above

---

## Alternative: Fly.io ✈️

**Great for containers, global edge deployment.**

### Free Tier
- 3 shared-cpu VMs (256MB RAM each)
- 160GB outbound data transfer
- Good for demos

### Deployment Steps

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   fly auth login
   ```

3. **Create a `Dockerfile`** (create this file in your project root):
   
   ```dockerfile
   FROM node:18-slim
   
   # Install Playwright dependencies
   RUN apt-get update && apt-get install -y \
       libnss3 \
       libnspr4 \
       libatk1.0-0 \
       libatk-bridge2.0-0 \
       libcups2 \
       libdrm2 \
       libdbus-1-3 \
       libxkbcommon0 \
       libxcomposite1 \
       libxdamage1 \
       libxfixes3 \
       libxrandr2 \
       libgbm1 \
       libasound2 \
       libpango-1.0-0 \
       libcairo2 \
       && rm -rf /var/lib/apt/lists/*
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm ci
   
   RUN npx playwright install --with-deps chromium
   
   COPY . .
   RUN npm run build
   
   EXPOSE 3000
   
   CMD ["npm", "start"]
   ```

4. **Initialize Fly app**
   ```bash
   fly launch
   ```
   - Follow the prompts
   - Choose a name for your app
   - Select a region
   - Don't deploy yet (we'll create Dockerfile first)

5. **Create `fly.toml`** (if not created automatically):
   
   ```toml
   app = "your-app-name"
   primary_region = "iad"
   
   [build]
   
   [http_service]
     internal_port = 3000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
     processes = ["app"]
   
   [[vm]]
     memory_mb = 512
     cpu_kind = "shared"
     cpus = 1
   ```

6. **Deploy**
   ```bash
   fly deploy
   ```

---

## Alternative: Replit 🟢

**Easiest setup, good for quick demos.**

### Free Tier
- Always-on option available
- Simple interface
- Performance may be limited

### Deployment Steps

1. **Create a Replit account**
   - Go to https://replit.com
   - Sign up

2. **Import from GitHub**
   - Click "Create Repl"
   - Select "Import from GitHub"
   - Enter your repository URL

3. **Install dependencies**
   - Repl will automatically run `npm install`
   - Run `npx playwright install chromium` in the shell

4. **Configure run command**
   - Set the run command to: `npm run dev` (for development) or `npm start` (for production)
   - Make sure to build first: `npm run build`

5. **Keep alive**
   - Free tier may require "Always On" add-on (check Replit's current policy)

---

## Environment Variables

If your application uses environment variables, set them in your hosting platform:

Common variables you might need:
- `NODE_ENV=production`
- Any API keys or configuration (if applicable)

---

## Testing Your Deployment

After deployment, test your API endpoints:

```bash
curl -X POST https://your-app-url.com/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "tripType": "Viajes Por Día",
    "origin": "Venezuela",
    "destination": "Europa",
    "departureDate": "01/02/2026",
    "returnDate": "10/02/2026",
    "passengers": 1,
    "ages": [30]
  }'
```

---

## Troubleshooting

### Playwright Browser Not Found
- Make sure Playwright browsers are installed during build
- Check that `npx playwright install --with-deps chromium` runs successfully
- Verify the installation in build logs

### Out of Memory Errors
- Increase memory allocation (may require paid tier)
- Optimize Playwright args (already done in code)
- Consider using Puppeteer instead (smaller, but less reliable)

### Timeout Issues
- Increase timeout in your hosting platform settings
- Check network connectivity from the server
- Verify the target website is accessible

### Cold Start Delays
- Use a platform with persistent containers (Railway, Fly.io)
- Avoid Render if cold starts are problematic
- Consider using a "keep-alive" service for free tiers

---

## Cost Comparison (Free Tiers)

| Platform | Free Tier | Best For |
|----------|-----------|----------|
| **Railway** | $5 credit/month | Best overall, reliable |
| **Render** | 750 hrs/month | Good for demos, may spin down |
| **Fly.io** | 3 VMs, 256MB each | Good for containers |
| **Replit** | Always-on available | Easiest setup, limited performance |

---

## Recommendation

For a **demo**, I recommend **Railway**:
- ✅ Easiest setup
- ✅ Reliable (no cold starts)
- ✅ Good free tier
- ✅ Excellent Next.js support
- ✅ Playwright works out of the box

For **production**, consider:
- **Railway** (paid tier for better performance)
- **Fly.io** (scales well, global edge)
- **DigitalOcean App Platform** (predictable pricing)

