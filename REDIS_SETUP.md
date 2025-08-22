# Redis Analytics Setup Guide

## Overview

This DAM Backend now includes Redis-powered real-time analytics for comprehensive asset usage tracking, user behavior analysis, and performance metrics.

## Redis Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Redis Configuration (for Analytics)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Default Values

- **Host**: `localhost`
- **Port**: `6379`
- **Password**: None (empty)
- **Database**: `0`

## Installation

### Option 1: Local Redis Installation

```bash
# Windows (using Chocolatey)
choco install redis-64

# macOS (using Homebrew)
brew install redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
```

### Option 2: Docker Redis

```bash
# Run Redis in Docker
docker run -d --name redis-analytics -p 6379:6379 redis:alpine

# Or add to your docker-compose.yml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## New Analytics Endpoints

### 1. Asset Usage Analytics

```bash
GET /api/stats/asset/:assetId/analytics
```

Get detailed analytics for a specific asset including views, downloads, and popularity score.

### 2. Track Asset Views

```bash
POST /api/stats/track-view
Body: { "assetId": 71, "userId": "user123", "metadata": {...} }
```

Track when an asset is viewed for analytics.

### 3. Track Asset Downloads

```bash
POST /api/stats/track-download
Body: { "assetId": 71, "userId": "user123", "metadata": {...} }
```

Track when an asset is downloaded for analytics.

### 4. User Behavior Analytics

```bash
GET /api/stats/user/:userId/behavior
```

Get user behavior patterns, activity levels, and segmentation.

### 5. Real-time Statistics

```bash
GET /api/stats/realtime
```

Get live statistics including total views, downloads, and uploads.

## Features

### Real-time Analytics

- **Live Tracking**: Views and downloads are tracked in real-time
- **Popular Assets**: Dynamic popularity scoring based on access patterns
- **User Segmentation**: Power users, regular users, casual users
- **Performance Metrics**: Response times, error rates, availability

### Data Persistence

- **Redis Storage**: Fast in-memory analytics storage
- **Fallback Support**: Graceful degradation when Redis is unavailable
- **Hybrid Approach**: Combines Redis analytics with PostgreSQL asset data

### Scalability

- **High Performance**: Redis handles thousands of analytics operations per second
- **Memory Efficient**: Optimized data structures for analytics
- **Horizontal Scaling**: Can be extended to Redis Cluster for production

## Testing

### 1. Start Redis

```bash
# Start Redis server
redis-server

# Or if using Docker
docker start redis-analytics
```

### 2. Test Connection

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

### 3. Test Analytics Endpoints

```bash
# Track a view
curl -X POST http://localhost:3000/api/stats/track-view \
  -H "Content-Type: application/json" \
  -d '{"assetId": 71, "userId": "test-user"}'

# Get asset analytics
curl http://localhost:3000/api/stats/asset/71/analytics

# Get real-time stats
curl http://localhost:3000/api/stats/realtime
```

## Monitoring

### Redis Commands for Debugging

```bash
# Connect to Redis CLI
redis-cli

# View all keys
KEYS *

# View analytics keys
KEYS stats:*
KEYS asset:*

# Get specific analytics
GET stats:total:views
GET asset:71:views

# View popular assets
ZRANGE stats:popular:assets 0 -1 WITHSCORES
```

### Health Check

The `/health` endpoint now includes Redis status:

```json
{
  "status": "OK",
  "services": {
    "database": "connected",
    "redis": "connected",
    "server": "running"
  }
}
```

## Production Considerations

### 1. Redis Persistence

```bash
# Enable RDB persistence
redis-server --save 900 1 --save 300 10 --save 60 10000

# Enable AOF persistence
redis-server --appendonly yes
```

### 2. Security

```bash
# Set Redis password
redis-server --requirepass your_strong_password

# Update .env
REDIS_PASSWORD=your_strong_password
```

### 3. High Availability

- Use Redis Sentinel for failover
- Consider Redis Cluster for large deployments
- Implement backup and recovery procedures

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check if Redis server is running
   - Verify host and port in .env
   - Check firewall settings

2. **Analytics Not Updating**
   - Verify Redis connection in logs
   - Check if tracking endpoints are being called
   - Monitor Redis memory usage

3. **Performance Issues**
   - Monitor Redis memory usage
   - Check for slow queries
   - Consider Redis optimization

### Log Messages

- `Redis: Connected successfully` - Redis is working
- `Redis: Connection error` - Redis connection failed
- `Redis not available, skipping analytics tracking` - Fallback mode active

## Benefits

**Real-time Analytics**: Live tracking of asset usage
**High Performance**: Redis handles thousands of operations per second
**User Insights**: Detailed user behavior analysis
**Popularity Scoring**: Dynamic asset popularity based on usage
**Scalable**: Can handle large volumes of analytics data
**Fallback Support**: Continues working even if Redis is down
**Easy Integration**: Simple API endpoints for tracking

## Next Steps

1. **Install Redis** on your system
2. **Configure environment variables**
3. **Test the new endpoints**
4. **Integrate tracking** into your frontend
5. **Monitor performance** and scale as needed

Your DAM system now has enterprise-grade analytics capabilities! 🚀
