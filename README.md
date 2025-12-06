# HireNexa (Application Tracking System)

This is a modern full-stack application for tracking job applications and managing candidates.

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Shadcn/UI
- **Authentication**: Firebase Authentication
- **Database**: MongoDB with Mongoose
- **Storage**: AWS S3
- **AI Integration**: Google Gemini API for Resume Analysis
- **Backend**: Express.js API with TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local instance or MongoDB Atlas)
- Firebase project (for authentication)
- AWS S3 bucket (for file storage)
- Google Gemini API key (for resume analysis)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/Application-Tracking-System.git
   cd Application-Tracking-System
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   - Create a `.env.local` file based on `.env.local.example` for frontend configuration
   - Update the existing `.env` file with your MongoDB, Firebase Admin, and other backend configurations

4. Start the development server
   ```bash
   # Run both frontend and backend
   npm run dev
   
   # Run only frontend
   npm run dev:frontend
   
   # Run only backend
   npm run dev:server
   ```

## Firebase Configuration

The application uses Firebase for authentication only. All data storage now uses MongoDB.

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Set up Authentication with Email/Password provider
3. Generate a Firebase Admin SDK private key for the backend

## MongoDB Setup

1. Create a MongoDB database (local or MongoDB Atlas)
2. Update the `MONGODB_URI` in your `.env` file

## AWS S3 Configuration

1. Create an AWS S3 bucket for file storage
2. Configure CORS settings for your S3 bucket
3. Update the AWS configuration in your environment variables

## Deployment

### Deploying the Frontend
- Deploy the Next.js frontend on Vercel, Netlify, or your preferred hosting platform

### Deploying the Backend
- Deploy the Express.js backend on Heroku, Render, or your preferred hosting platform

## Features

- User authentication with role-based access (admin/user)
- Resume upload and analysis using AI
- Candidate tracking with custom stages
- Job posting management
- Vendor management
- Matching system between candidates and job requirements
- Mobile-responsive design with dark/light mode

# ATS-Resume-Checker
