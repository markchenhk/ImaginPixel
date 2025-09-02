# AI Product Studio - Docker Deployment Guide

This guide will help you deploy AI Product Studio on a Linux server using Docker Compose.

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- Domain name pointed to your server (for SSL)
- At least 4GB RAM and 20GB disk space

## Quick Start

1. **Clone or upload the project files to your server:**
   ```bash
   # If using git
   git clone <your-repository> /opt/ai-product-studio
   cd /opt/ai-product-studio
   
   # Or upload files manually to /opt/ai-product-studio
   ```

2. **Run the automated deployment script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Follow the prompts to configure your environment variables.**

## Manual Deployment Steps

### 1. Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to docker group
sudo usermod -aG docker $USER
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file
nano .env
```

**Required variables to configure:**

```bash
# Database
POSTGRES_PASSWORD=your-strong-password

# Security
SESSION_SECRET=your-super-secret-session-key

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=your-s3-bucket

# OpenRouter API (for AI features)
OPENROUTER_API_KEY=your-openrouter-api-key

# Domain configuration
APP_URL=https://yourdomain.com
REPLIT_DOMAINS=yourdomain.com
```

### 3. Set Up SSL Certificates (Optional but Recommended)

```bash
# Create SSL directory
mkdir -p ssl

# If using Let's Encrypt with Certbot
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/
sudo chown $USER:$USER ssl/*.pem
```

### 4. Deploy the Application

```bash
# Build and start all services
docker-compose up -d

# Run database migrations
docker-compose exec app npm run db:push

# Check status
docker-compose ps
```

## Service Management

### Using the deployment script:

```bash
# Deploy or update
./deploy.sh

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Update application
./deploy.sh update

# Stop services
./deploy.sh stop

# Create database backup
./deploy.sh backup
```

### Using Docker Compose directly:

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# Restart a specific service
docker-compose restart app

# Scale services (if needed)
docker-compose up -d --scale app=2
```

## Production Deployment

For production environments, use the production compose file:

```bash
# Deploy with production settings
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Systemd Integration

To automatically start the application on server boot:

```bash
# Copy service file
sudo cp ai-product-studio.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable ai-product-studio
sudo systemctl start ai-product-studio

# Check status
sudo systemctl status ai-product-studio
```

## Monitoring and Maintenance

### View Application Logs
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f postgres

# Nginx logs
docker-compose logs -f nginx
```

### Database Management
```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d ai_product_studio

# Create backup
docker-compose exec postgres pg_dump -U postgres ai_product_studio > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres -d ai_product_studio < backup.sql
```

### Updates and Maintenance
```bash
# Update application code
git pull  # if using git
docker-compose build --no-cache app
docker-compose up -d app

# Update system packages
sudo apt update && sudo apt upgrade

# Clean up Docker
docker system prune -f
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 80, 443, and 5000 are not in use
2. **Permission issues**: Check file ownership and Docker group membership
3. **Memory issues**: Ensure adequate RAM for all services
4. **SSL issues**: Verify certificate paths and permissions

### Debug Commands
```bash
# Check service health
docker-compose exec app wget -qO- http://localhost:5000/api/health

# Check database connectivity
docker-compose exec app node -e "console.log(process.env.DATABASE_URL)"

# View environment variables
docker-compose exec app env | grep -E "(NODE_ENV|DATABASE_URL|PORT)"
```

## Security Considerations

1. **Firewall**: Configure UFW or iptables to restrict access
2. **SSL**: Always use HTTPS in production
3. **Updates**: Keep Docker images and system packages updated
4. **Backups**: Implement regular database backups
5. **Monitoring**: Set up log monitoring and alerting
6. **Secrets**: Never commit .env files to version control

## Performance Optimization

1. **Resource Limits**: Configure Docker resource limits
2. **Nginx Caching**: Enable appropriate caching headers
3. **Database Tuning**: Optimize PostgreSQL settings for your workload
4. **CDN**: Consider using a CDN for static assets
5. **Load Balancing**: Scale horizontally if needed

## Support

For issues and questions:
1. Check the application logs
2. Review this documentation
3. Check Docker and system logs
4. Verify environment configuration