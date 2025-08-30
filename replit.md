# AI Image Editor

## Overview

An AI-powered image editing application that allows users to upload images and interact with them through a chat interface. The application integrates with OpenRouter API to process images using various AI models like GPT-4o and Claude 3.5 Sonnet. Users can apply enhancements, get image analysis, and view before/after comparisons through an intuitive web interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Build Tool**: Vite with custom configuration for monorepo structure

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Handling**: Multer for image uploads with 10MB limit
- **Session Management**: Built-in session handling with PostgreSQL storage
- **API Structure**: RESTful endpoints for conversations, messages, and image processing

### Database Schema Design
- **Conversations**: Track chat sessions with titles and timestamps
- **Messages**: Store user and assistant messages with image URLs and processing status
- **Image Processing Jobs**: Track async image processing with status, timing, and enhancement details
- **Model Configurations**: Store user preferences for AI models and processing settings

### Image Processing Pipeline
- **Upload Handling**: Local file storage with type validation (JPEG, PNG, WebP)
- **AI Integration**: OpenRouter API for image analysis and processing
- **Status Tracking**: Real-time job status updates with polling mechanism
- **Comparison Interface**: Side-by-side before/after image viewer with slider control

### Development Environment
- **Memory Storage**: In-memory data storage for development (production-ready for database migration)
- **Hot Reloading**: Vite development server with HMR
- **Type Safety**: Shared TypeScript schemas between frontend and backend
- **Error Handling**: Comprehensive error boundaries and API error management

## External Dependencies

### AI Services
- **OpenRouter API**: Primary AI service for image processing and analysis
- **Supported Models**: GPT-4o, Claude 3.5 Sonnet, and other vision-capable models

### Database
- **Neon Database**: Serverless PostgreSQL for production data storage
- **Drizzle Kit**: Database migrations and schema management

### UI and Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### File Handling
- **Multer**: Express middleware for handling multipart/form-data
- **React Dropzone**: Drag-and-drop file upload interface

### Development Tools
- **ESBuild**: Fast JavaScript bundler for production builds
- **TSX**: TypeScript execution for development server
- **Replit Integration**: Development environment optimization for Replit platform