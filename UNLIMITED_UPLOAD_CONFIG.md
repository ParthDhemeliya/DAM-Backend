# 🚀 Unlimited File Upload Configuration

This document explains how the DAM Backend is configured for truly unlimited file uploads.

## ✅ What We've Implemented

### 1. **Multer Configuration - No Limits**

- **Removed all `limits` configuration** from multer
- **Using `multer.diskStorage()`** for optimal large file handling
- **Busboy (multer's underlying library)** handles unlimited by default when no limits are specified

```typescript
const uploadUnlimited = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      /* ... */
    },
    filename: (req, file, cb) => {
      /* ... */
    },
  }),
  // 🚫 NO LIMITS CONFIGURED - Truly unlimited
  fileFilter: (req, file, cb) => {
    /* ... */
  },
})
```

### 2. **Express Body Parsers - No Limits**

- **Skipped body parsing for upload routes** to prevent interference
- **Removed all limits** from `express.json()` and `express.urlencoded()`
- **Conditional middleware** that excludes upload routes from body parsing

```typescript
// Skip body parsing for upload routes
if (req.path.startsWith('/api/assets/upload')) {
  return next() // Skip body parsing
}

// Apply body parsing for all other routes - NO LIMITS
express.json()(req, res, next)
express.urlencoded({ extended: true })(req, res, next)
```

### 3. **Nginx Configuration - Unlimited Proxy**

- **`client_max_body_size 0`** - No file size limit
- **`proxy_read_timeout 0`** - No read timeout for large uploads
- **`proxy_send_timeout 0`** - No send timeout for large uploads
- **`proxy_buffering off`** - Disable buffering for streaming
- **`proxy_request_buffering off`** - Disable request buffering

```nginx
location /api/ {
    # Unlimited upload configuration
    client_max_body_size 0;  # No file size limit
    proxy_read_timeout 0;    # No read timeout for large uploads
    proxy_send_timeout 0;    # No send timeout for large uploads

    # Buffer settings for large files
    proxy_buffering off;     # Disable buffering for streaming
    proxy_request_buffering off;  # Disable request buffering
}
```

### 4. **Node.js Server Configuration**

- **`server.timeout = 0`** - No timeout for large uploads
- **`socket.setTimeout(0)`** - No socket timeout
- **8GB heap allocation** for large file processing

## 🔍 How It Works

### File Upload Flow:

1. **Client** sends file to `/api/assets/upload`
2. **Nginx** receives request with `client_max_body_size 0` (unlimited)
3. **Express** skips body parsing for upload routes
4. **Multer** processes file with no size limits
5. **File** is saved to disk using `multer.diskStorage()`
6. **Asset** is created in database
7. **Background jobs** are queued for processing

### Why This Approach Works:

- **No artificial limits** in any layer
- **Disk streaming** prevents memory issues
- **Conditional body parsing** prevents Express interference
- **Nginx unlimited proxy** handles large files efficiently

## ⚠️ Important Notes

### "Unlimited" Reality Check:

While we've removed all artificial limits, you're still constrained by:

- **Disk space** on your server
- **Network bandwidth** and timeouts
- **Operating system** file size limits
- **HTTP client** capabilities

### Practical Limits:

- **Single file**: Limited only by disk space
- **Concurrent uploads**: Limited by server resources
- **Total storage**: Limited by available disk space

## 🧪 Testing Unlimited Uploads

### Debug Endpoint:

```bash
GET /api/assets/debug-config
```

### Test Upload:

```bash
curl -X POST http://localhost:5000/api/assets/upload \
  -F "file=@large-file.zip" \
  -F "category=test" \
  -F "description=Testing unlimited uploads"
```

## 🚨 Security Considerations

### Protection Measures:

- **File type validation** (mime type checking)
- **Virus scanning** (if implemented)
- **User authentication** (if implemented)
- **Rate limiting** (if implemented)

### Monitoring:

- **Disk space monitoring**
- **Upload rate monitoring**
- **Error logging and alerting**

## 🔧 Troubleshooting

### Common Issues:

1. **"413 Request Entity Too Large"**
   - Check nginx `client_max_body_size` setting
   - Verify nginx configuration is loaded

2. **"Request timeout"**
   - Check `proxy_read_timeout` and `proxy_send_timeout`
   - Verify client timeout settings

3. **"Memory issues"**
   - Ensure using `multer.diskStorage()` (not memory storage)
   - Check Node.js heap size allocation

4. **"File corruption"**
   - Verify `proxy_buffering off` is set
   - Check for network interruptions

### Debug Commands:

```bash
# Check nginx configuration
nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check server logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Check application logs
tail -f ./logs/app.log
```

## 📚 References

- [Multer Documentation](https://github.com/expressjs/multer)
- [Busboy Documentation](https://github.com/mscdex/busboy)
- [Nginx Upload Module](http://nginx.org/en/docs/http/ngx_http_upload_module.html)
- [Express Body Parser](https://expressjs.com/en/api.html#express.json)

## 🎯 Best Practices

1. **Monitor disk space** regularly
2. **Implement cleanup** for failed uploads
3. **Use streaming** for very large files
4. **Implement progress tracking** for user experience
5. **Add retry logic** for network failures
6. **Monitor upload performance** and optimize as needed

---

**Last Updated**: $(date)
**Configuration Version**: 2.0 (Unlimited)
**Status**: ✅ Active
