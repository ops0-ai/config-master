# Self-Hosting Configuration

## Quick Setup for Different Servers

When deploying to a new server, the `setup.sh` script will automatically detect your server's IP and configure the environment variables.

### Manual Configuration (if needed)

If you need to manually configure for a specific IP address:

1. **Update the main .env file:**
   ```bash
   # Edit .env file
   FRONTEND_URL=http://YOUR_SERVER_IP:3000
   NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:5005/api
   ALLOW_SELF_HOSTED_CORS=true
   ```

2. **Update the web .env file:**
   ```bash
   # Edit apps/web/.env file
   NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:5005/api
   NEXT_TELEMETRY_DISABLED=1
   ```

3. **Rebuild the web container:**
   ```bash
   docker-compose down
   docker-compose build --no-cache web
   docker-compose up -d
   ```

### Environment Variables Explained

- `FRONTEND_URL`: The URL where your frontend will be accessible
- `NEXT_PUBLIC_API_URL`: The API URL that the frontend will use (must include `/api`)
- `ALLOW_SELF_HOSTED_CORS`: Enables flexible CORS for self-hosted deployments
- `NEXT_TELEMETRY_DISABLED`: Disables Next.js telemetry

### Common IP Examples

Replace `YOUR_SERVER_IP` with your actual server IP:
- AWS EC2: `http://3.108.197.149:5005/api`
- DigitalOcean: `http://164.90.XXX.XXX:5005/api`
- Local network: `http://192.168.1.100:5005/api`

### Troubleshooting

If you see CORS errors:
1. Check that `ALLOW_SELF_HOSTED_CORS=true` is set
2. Verify the web container was rebuilt after changing environment variables
3. Ensure the API URL includes the correct port (5005) and `/api` suffix