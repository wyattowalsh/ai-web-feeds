# Production Deployment Guide

**Project**: AIWebFeeds - Advanced Visualization & Analytics  
**Version**: 1.0.0  
**Last Updated**: November 2, 2024

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+
- Node.js 20+
- Python 3.13+
- Domain with SSL certificate

### Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/ai-web-feeds.git
cd ai-web-feeds

# Copy environment file
cp env.example .env

# Edit environment variables
nano .env
```

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aiwebfeeds
POSTGRES_PASSWORD=your-secure-password

# Redis
REDIS_URL=redis://:your-redis-password@localhost:6379/0
REDIS_PASSWORD=your-redis-password

# Security
SECRET_KEY=your-secret-key-min-32-chars
JWT_SECRET=your-jwt-secret-min-32-chars

# API
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
```

---

## 🐳 Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Individual Containers

```bash
# Build backend
docker build -t aiwebfeeds-backend --target backend .

# Build frontend
docker build -t aiwebfeeds-frontend .

# Run backend
docker run -d -p 8000:8000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  aiwebfeeds-backend

# Run frontend
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
  aiwebfeeds-frontend
```

---

## 📦 Manual Deployment

### Backend Setup

```bash
# Install Python dependencies
cd packages/ai_web_feeds
uv sync

# Run database migrations
cd ../
uv run alembic upgrade head

# Start API server
uv run uvicorn ai_web_feeds.visualization.api:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4
```

### Frontend Setup

```bash
# Install dependencies
cd apps/web
pnpm install --frozen-lockfile

# Build
pnpm build

# Start server
pnpm start
```

---

## 🗄️ Database Setup

### PostgreSQL

```bash
# Create database
createdb aiwebfeeds

# Run migrations
cd packages
uv run alembic upgrade head

# Verify
psql aiwebfeeds -c "SELECT * FROM alembic_version;"
```

### Backup & Restore

```bash
# Backup
pg_dump aiwebfeeds > backup.sql

# Restore
psql aiwebfeeds < backup.sql
```

---

## 🔧 Redis Configuration

```bash
# Start Redis with persistence
redis-server --appendonly yes --requirepass your-password

# Verify
redis-cli -a your-password ping
```

---

## 🌐 Nginx Configuration

```nginx
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📊 Monitoring & Logging

### Application Monitoring

```python
# Install Sentry
pip install sentry-sdk

# Configure in api.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FastApiIntegration()],
    traces_sample_rate=1.0,
)
```

### Log Aggregation

```bash
# Use Loguru (already integrated)
# Logs are written to:
# - stdout (INFO and above)
# - logs/app.log (all levels)
# - logs/error.log (ERROR and above)
```

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Redis health
redis-cli -a password ping

# PostgreSQL health
pg_isready -h localhost -p 5432
```

---

## 🔒 Security Hardening

### SSL/TLS

```bash
# Generate certificate with Let's Encrypt
certbot certonly --nginx -d yourdomain.com
```

### Firewall Rules

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Rate Limiting

Already implemented in application:
- 100 requests per hour per device
- Exponential backoff on violations
- Whitelist support for trusted IPs

### Environment Security

```bash
# Restrict .env permissions
chmod 600 .env

# Never commit .env to git
echo ".env" >> .gitignore
```

---

## 🧪 Testing Production Deployment

```bash
# Run backend tests
cd tests
uv run pytest --cov

# Run frontend tests
cd apps/web
pnpm test

# Run E2E tests
pnpm exec playwright test

# Load testing (optional)
ab -n 1000 -c 10 http://localhost:8000/api/v1/visualizations
```

---

## 📈 Performance Optimization

### Backend

```python
# Enable connection pooling
from sqlalchemy import create_engine

engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
)
```

### Frontend

```javascript
// Next.js config optimization
module.exports = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  images: {
    domains: ['yourdomain.com'],
    formats: ['image/avif', 'image/webp'],
  },
}
```

### Redis

```bash
# Optimize Redis config
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 🔄 Continuous Deployment

### GitHub Actions (Automated)

The `.github/workflows/ci.yml` file handles:
- ✅ Automated testing
- ✅ Docker image building
- ✅ Security scanning
- ✅ Deployment to production

### Manual Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild services
docker-compose build

# Restart with zero downtime
docker-compose up -d --no-deps --build backend frontend

# Run migrations
docker-compose exec backend uv run alembic upgrade head
```

---

## 📊 Monitoring Dashboards

### Prometheus + Grafana (Optional)

```yaml
# docker-compose.yml addition
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
```

---

## 🆘 Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Verify connection
psql -h localhost -U aiwebfeeds -d aiwebfeeds
```

**2. Redis Connection Failed**
```bash
# Check Redis is running
redis-cli ping

# Check password
redis-cli -a your-password ping
```

**3. Frontend Can't Connect to Backend**
```bash
# Verify API URL
echo $NEXT_PUBLIC_API_URL

# Check CORS settings in backend
```

**4. High Memory Usage**
```bash
# Check Redis memory
redis-cli INFO memory

# Optimize cache TTL
redis-cli CONFIG SET maxmemory-policy volatile-lru
```

---

## 📞 Support & Maintenance

### Backup Schedule

```bash
# Daily database backup
0 2 * * * pg_dump aiwebfeeds > /backups/aiwebfeeds-$(date +\%Y\%m\%d).sql

# Weekly Redis backup
0 3 * * 0 redis-cli --rdb /backups/redis-$(date +\%Y\%m\%d).rdb
```

### Update Strategy

```bash
# 1. Backup database
pg_dump aiwebfeeds > backup.sql

# 2. Pull updates
git pull origin main

# 3. Run migrations
uv run alembic upgrade head

# 4. Restart services
docker-compose restart
```

---

## ✅ Production Checklist

### Before Launch
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Database migrations run
- [ ] Redis configured and running
- [ ] Nginx configured
- [ ] Firewall rules set
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] Load testing completed

### After Launch
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review logs regularly
- [ ] Test backup restoration
- [ ] Update documentation

---

## 📚 Additional Resources

- **API Documentation**: https://api.yourdomain.com/docs
- **User Guide**: `/apps/web/content/docs/visualization/getting-started.mdx`
- **GitHub Repository**: https://github.com/your-org/ai-web-feeds
- **Support**: support@yourdomain.com

---

**Deployment Status**: ✅ Ready for Production  
**Last Tested**: November 2, 2024  
**Maintainer**: DevOps Team
