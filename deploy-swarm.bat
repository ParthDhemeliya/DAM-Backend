@echo off
echo Starting DAM Docker Swarm Deployment...

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo SUCCESS: Docker is running

REM Check if Docker Swarm is initialized
for /f "tokens=*" %%i in ('docker info --format "{{.Swarm.LocalNodeState}}" 2^>nul') do set swarmState=%%i
if "%swarmState%"=="inactive" (
    echo INFO: Initializing Docker Swarm...
    docker swarm init
    if %errorlevel% neq 0 (
        echo ERROR: Failed to initialize Docker Swarm
        pause
        exit /b 1
    )
    echo SUCCESS: Docker Swarm initialized
) else (
    echo SUCCESS: Docker Swarm is already active
)

REM Create necessary directories
echo INFO: Creating necessary directories...
if not exist "uploads" mkdir uploads
if not exist "logs" mkdir logs
if not exist "nginx\ssl" mkdir nginx\ssl
if not exist "database\init" mkdir database\init
if not exist "monitoring" mkdir monitoring

REM Build the backend image
echo INFO: Building DAM backend image...
docker build -t dam-backend:latest .
if %errorlevel% neq 0 (
    echo ERROR: Failed to build backend image
    pause
    exit /b 1
)
echo SUCCESS: Backend image built successfully

REM Deploy the stack
echo INFO: Deploying DAM stack to Docker Swarm...
docker stack deploy -c docker-stack.yml dam-stack
if %errorlevel% neq 0 (
    echo ERROR: Failed to deploy stack
    pause
    exit /b 1
)

REM Wait for services to start
echo INFO: Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check service status
echo INFO: Checking service status...
docker service ls --filter "label=com.docker.stack.namespace=dam-stack"

echo.
echo SUCCESS: DAM Stack deployed successfully!
echo.
echo Service URLs:
echo   Backend API: http://localhost:8000
echo   Nginx (HTTP): http://localhost
echo   Nginx (HTTPS): https://localhost
echo   Prometheus: http://localhost:9090
echo.
echo Useful commands:
echo   View services: docker service ls
echo   View logs: docker service logs dam-stack_dam-backend
echo   Scale service: docker service scale dam-stack_dam-backend=3
echo   Remove stack: docker stack rm dam-stack

pause
