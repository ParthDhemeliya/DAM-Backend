# DAM Docker Swarm Deployment Script
# This script sets up and deploys the DAM application to Docker Swarm

param(
    [string]$Environment = "development",
    [switch]$Help
)

if ($Help) {
    Write-Host @"
DAM Docker Swarm Deployment Script

Usage: .\deploy-swarm.ps1 [-Environment <environment>] [-Help]

Parameters:
    -Environment    Deployment environment (development, staging, production)
    -Help          Show this help message

Examples:
    .\deploy-swarm.ps1
    .\deploy-swarm.ps1 -Environment production
    .\deploy-swarm.ps1 -Help
"@
    exit 0
}

Write-Host "Starting DAM Docker Swarm Deployment..." -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "SUCCESS: Docker is running" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Swarm is initialized
$swarmInfo = docker info --format '{{.Swarm.LocalNodeState}}' 2>$null
if ($swarmInfo -eq "inactive") {
    Write-Host "INFO: Initializing Docker Swarm..." -ForegroundColor Yellow
    docker swarm init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to initialize Docker Swarm" -ForegroundColor Red
        exit 1
    }
    Write-Host "SUCCESS: Docker Swarm initialized" -ForegroundColor Green
} else {
    Write-Host "SUCCESS: Docker Swarm is already active" -ForegroundColor Green
}

# Create necessary directories
Write-Host "INFO: Creating necessary directories..." -ForegroundColor Yellow
$directories = @(
    "uploads",
    "logs", 
    "nginx/ssl",
    "database/init",
    "monitoring"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Gray
    }
}

# Generate self-signed SSL certificate for development
if ($Environment -eq "development" -and !(Test-Path "nginx/ssl/cert.pem")) {
    Write-Host "INFO: Generating self-signed SSL certificate..." -ForegroundColor Yellow
    
    # Create OpenSSL configuration
    $opensslConfig = @"
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Organization
OU = Organizational Unit
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
"@
    
    $opensslConfig | Out-File -FilePath "nginx/ssl/openssl.conf" -Encoding ASCII
    
    # Generate certificate (requires OpenSSL to be installed)
    try {
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -config nginx/ssl/openssl.conf
        Write-Host "  SUCCESS: SSL certificate generated" -ForegroundColor Gray
    } catch {
        Write-Host "  WARNING: Could not generate SSL certificate. Please install OpenSSL or copy existing certificates." -ForegroundColor Yellow
    }
}

# Build the backend image
Write-Host "INFO: Building DAM backend image..." -ForegroundColor Yellow
docker build -t dam-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build backend image" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Backend image built successfully" -ForegroundColor Green

# Deploy the stack
Write-Host "INFO: Deploying DAM stack to Docker Swarm..." -ForegroundColor Yellow
docker stack deploy -c docker-stack.yml dam-stack
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to deploy stack" -ForegroundColor Red
    exit 1
}

# Wait for services to start
Write-Host "INFO: Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "INFO: Checking service status..." -ForegroundColor Yellow
docker service ls --filter "label=com.docker.stack.namespace=dam-stack"

# Show stack information
Write-Host "`nSUCCESS: DAM Stack deployed successfully!" -ForegroundColor Green
Write-Host "`nService URLs:" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "  Nginx (HTTP): http://localhost" -ForegroundColor White
Write-Host "  Nginx (HTTPS): https://localhost" -ForegroundColor White
Write-Host "  Prometheus: http://localhost:9090" -ForegroundColor White

Write-Host "`nUseful commands:" -ForegroundColor Cyan
Write-Host "  View services: docker service ls" -ForegroundColor White
Write-Host "  View logs: docker service logs dam-stack_dam-backend" -ForegroundColor White
Write-Host "  Scale service: docker service scale dam-stack_dam-backend=3" -ForegroundColor White
Write-Host "  Remove stack: docker stack rm dam-stack" -ForegroundColor White

Write-Host "`nNOTE: For production, replace self-signed certificates with proper SSL certificates." -ForegroundColor Yellow
