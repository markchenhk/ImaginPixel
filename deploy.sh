#!/bin/bash

# AI Product Studio Docker Deployment Script
# This script helps deploy the application using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_requirements() {
    print_status "Checking system requirements..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "All requirements met"
}

# Function to setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_warning ".env file created from .env.example"
            print_warning "Please edit .env file with your actual configuration values"
            print_warning "Required variables: POSTGRES_PASSWORD, SESSION_SECRET, AWS credentials, OPENROUTER_API_KEY"
            read -p "Press Enter after you've configured .env file..."
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
}

# Function to create SSL directory
setup_ssl() {
    print_status "Setting up SSL directory..."
    
    if [ ! -d "ssl" ]; then
        mkdir -p ssl
        print_warning "SSL directory created. Please add your SSL certificates:"
        print_warning "  - ssl/fullchain.pem"
        print_warning "  - ssl/privkey.pem"
        print_warning "Or disable the nginx service in docker-compose.yml if not using SSL"
    fi
}

# Function to build and start services
deploy() {
    print_status "Building and starting services..."
    
    # Pull latest images
    docker-compose pull
    
    # Build the application
    docker-compose build --no-cache app
    
    # Start the services
    docker-compose up -d
    
    print_success "Services started successfully"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Run database push (Drizzle migrations)
    docker-compose exec app npm run db:push
    
    print_success "Database migrations completed"
}

# Function to show status
show_status() {
    print_status "Service status:"
    docker-compose ps
    
    print_status "Application logs (last 20 lines):"
    docker-compose logs --tail=20 app
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up log rotation and monitoring..."
    
    # Create log rotation config for Docker
    cat > /etc/logrotate.d/docker-compose << EOF
/var/lib/docker/containers/*/*-json.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
EOF
    
    print_success "Log rotation configured"
}

# Function to show post-deployment instructions
show_instructions() {
    print_success "Deployment completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Configure your domain DNS to point to this server"
    echo "2. Set up SSL certificates in the ssl/ directory"
    echo "3. Update your environment variables as needed"
    echo "4. Monitor logs with: docker-compose logs -f"
    echo ""
    print_status "Useful commands:"
    echo "- View status: docker-compose ps"
    echo "- View logs: docker-compose logs -f [service_name]"
    echo "- Stop services: docker-compose down"
    echo "- Update app: docker-compose build app && docker-compose up -d app"
    echo "- Backup database: docker-compose exec postgres pg_dump -U postgres ai_product_studio > backup.sql"
    echo ""
    print_status "The application should be available at:"
    echo "- HTTP: http://localhost:80"
    echo "- HTTPS: https://localhost:443 (if SSL configured)"
    echo "- Direct app: http://localhost:5000"
}

# Main deployment function
main() {
    echo "================================================"
    echo "  AI Product Studio Docker Deployment"
    echo "================================================"
    echo ""
    
    check_requirements
    setup_environment
    setup_ssl
    deploy
    
    # Ask if user wants to run migrations
    read -p "Do you want to run database migrations now? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migrations
    fi
    
    show_status
    show_instructions
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose logs -f "${2:-app}"
        ;;
    "stop")
        print_status "Stopping services..."
        docker-compose down
        print_success "Services stopped"
        ;;
    "restart")
        print_status "Restarting services..."
        docker-compose restart
        print_success "Services restarted"
        ;;
    "update")
        print_status "Updating application..."
        docker-compose build --no-cache app
        docker-compose up -d app
        print_success "Application updated"
        ;;
    "backup")
        print_status "Creating database backup..."
        docker-compose exec postgres pg_dump -U postgres ai_product_studio > "backup_$(date +%Y%m%d_%H%M%S).sql"
        print_success "Database backup created"
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  status   - Show service status"
        echo "  logs     - Show logs [service_name]"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  update   - Update and restart app"
        echo "  backup   - Create database backup"
        echo "  help     - Show this help"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac