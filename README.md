# HireNexa - Intelligent Application Tracking System

<div align="center">

![HireNexa Logo](https://img.shields.io/badge/HireNexa-ATS-6366f1?style=for-the-badge)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.3-green?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**A modern, AI-powered Application Tracking System for streamlined recruitment**

[Live Demo](#) • [Documentation](#) • [Report Bug](https://github.com/yourusername/HireNexa/issues) • [Request Feature](https://github.com/yourusername/HireNexa/issues)

</div>

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Problem Statement

Recruitment processes in modern organizations face several critical challenges:

### The Challenge
- **Manual Resume Screening**: HR teams spend countless hours manually reviewing resumes, leading to inefficiency and potential oversight of qualified candidates
- **Inconsistent Evaluation**: Different recruiters may evaluate candidates differently, leading to bias and inconsistent hiring decisions
- **Poor Candidate Tracking**: Spreadsheets and email chains make it difficult to track candidate progress through the hiring pipeline
- **Limited Collaboration**: Recruitment teams struggle to collaborate effectively, leading to duplicated efforts and communication gaps
- **Data Silos**: Candidate information scattered across multiple platforms makes it hard to get insights and make data-driven decisions

### The Solution
HireNexa addresses these challenges by providing:
- **AI-Powered Resume Analysis**: Automatically extract skills, experience, and qualifications from resumes using Google Gemini AI
- **Intelligent Matching**: Match candidates to job requirements with AI-driven scoring and recommendations
- **Centralized Platform**: Single source of truth for all recruitment activities, from job posting to candidate onboarding
- **Collaborative Workflows**: Enable seamless collaboration between recruiters, hiring managers, and team members
- **Data-Driven Insights**: Analytics and reporting to optimize recruitment strategies and improve hiring outcomes

---

## ✨ Features

### 🤖 AI-Powered Resume Analysis
- **Automatic Information Extraction**: Extract candidate details, skills, experience, and education from resumes
- **Intelligent Skill Matching**: Match candidate skills with job requirements using AI algorithms
- **Resume Scoring**: Automatically score resumes based on job fit and qualifications
- **Duplicate Detection**: Identify duplicate resume submissions using file hash comparison

### 👥 Comprehensive Candidate Management
- **Candidate Profiles**: Detailed candidate profiles with resume, contact info, and application history
- **Custom Pipeline Stages**: Define custom recruitment stages (Applied, Screening, Interview, Offer, etc.)
- **Drag-and-Drop Kanban Board**: Visual pipeline management with drag-and-drop functionality
- **Activity Tracking**: Complete audit trail of all candidate interactions and status changes
- **Bulk Actions**: Perform actions on multiple candidates simultaneously

### 💼 Job Posting & Management
- **Job Creation Wizard**: Easy-to-use interface for creating detailed job postings
- **Custom Fields**: Add custom fields to capture specific job requirements
- **Job Templates**: Save and reuse job posting templates
- **Multi-Channel Publishing**: (Planned) Publish jobs to multiple job boards simultaneously
- **Application Forms**: Customizable application forms for each job posting

### 🏢 Vendor Management
- **Vendor Profiles**: Manage recruitment agencies and staffing vendors
- **Vendor Performance Tracking**: Track candidate submissions and placements by vendor
- **Vendor Portal**: (Planned) Dedicated portal for vendors to submit candidates
- **Commission Management**: (Planned) Track vendor commissions and payments

### 🔐 Role-Based Access Control
- **Admin Dashboard**: Full system access for administrators
- **User Roles**: Separate permissions for recruiters, hiring managers, and viewers
- **Secure Authentication**: Firebase-based authentication with email/password
- **User Management**: Admin interface for managing user accounts and permissions

### 📊 Analytics & Reporting
- **Pipeline Analytics**: Visualize candidate flow through recruitment stages
- **Time-to-Hire Metrics**: Track average time to fill positions
- **Source Tracking**: Identify most effective candidate sources
- **Custom Reports**: (Planned) Generate custom reports based on various metrics

### 🎨 Modern User Experience
- **Responsive Design**: Fully responsive interface works on desktop, tablet, and mobile
- **Dark/Light Mode**: Toggle between dark and light themes
- **Intuitive Navigation**: Clean, modern interface built with Shadcn/UI components
- **Real-time Updates**: Live updates using optimistic UI patterns
- **Keyboard Shortcuts**: (Planned) Productivity-enhancing keyboard shortcuts

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React framework with SSR/SSG | 14.2.24 |
| **React** | UI library | 18.x |
| **TypeScript** | Type-safe JavaScript | 5.x |
| **Tailwind CSS** | Utility-first CSS framework | 3.4.1 |
| **Shadcn/UI** | Component library | Latest |
| **Radix UI** | Headless UI primitives | Latest |
| **Framer Motion** | Animation library | 12.5.0 |
| **Zustand** | State management | 5.0.3 |
| **React Hook Form** | Form management | 7.55.0 |
| **TanStack Table** | Data tables | 8.21.2 |
| **Recharts** | Data visualization | 2.15.1 |

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Express.js** | Node.js web framework | 4.19.2 |
| **TypeScript** | Type-safe JavaScript | 5.x |
| **MongoDB** | NoSQL database | 8.3.1 |
| **Mongoose** | MongoDB ODM | 8.3.1 |
| **Firebase Admin** | Authentication | 12.0.0 |
| **JWT** | Token-based auth | 9.0.2 |
| **Helmet** | Security middleware | 8.1.0 |
| **CORS** | Cross-origin requests | 2.8.5 |
| **Express Rate Limit** | API rate limiting | 7.5.0 |

### AI & Cloud Services
| Service | Purpose |
|---------|---------|
| **Google Gemini AI** | Resume analysis and NLP |
| **Firebase Authentication** | User authentication |
| **AWS S3** | Resume file storage |
| **MongoDB Atlas** | Cloud database (production) |

### Development Tools
| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **Nodemon** | Development server |
| **Concurrently** | Run multiple scripts |
| **ts-node** | TypeScript execution |

---

## 🏗 Architecture

### System Architecture Diagram

![Architecture Diagram](./screenshots/architecture.png)

### Architecture Overview

HireNexa follows a modern **three-tier architecture** with clear separation of concerns:

#### 1. **Presentation Layer (Frontend)**
- **Next.js 14** with App Router for server-side rendering and optimal performance
- **TypeScript** for type safety and better developer experience
- **Tailwind CSS + Shadcn/UI** for consistent, accessible UI components
- **Zustand** for lightweight state management
- **React Hook Form** for efficient form handling

#### 2. **Application Layer (Backend API)**
- **Express.js** REST API with TypeScript
- **JWT-based authentication** with Firebase Admin SDK
- **Middleware stack**: CORS, Helmet (security), Rate Limiting
- **MVC pattern**: Organized into routes, controllers, and models
- **Error handling**: Centralized error handling and logging

#### 3. **Data Layer**
- **MongoDB** with Mongoose ODM for flexible, schema-based data modeling
- **AWS S3** for scalable file storage (resumes, documents)
- **Google Gemini AI** for intelligent resume parsing and analysis

### Data Flow

```
User → Next.js Frontend → Firebase Auth → Express API → MongoDB/S3/Gemini AI
                                                    ↓
                                            Response with Data
```

1. **Authentication Flow**:
   - User signs in via Firebase Authentication
   - Frontend receives Firebase ID token
   - Token sent with API requests
   - Backend verifies token with Firebase Admin SDK
   - User data retrieved from MongoDB

2. **Resume Upload Flow**:
   - User uploads resume via drag-and-drop
   - File uploaded to AWS S3
   - S3 URL stored in MongoDB
   - Resume sent to Gemini AI for analysis
   - Extracted data (skills, experience) stored in MongoDB
   - Results displayed to user

3. **Candidate Management Flow**:
   - CRUD operations via REST API
   - Optimistic UI updates for instant feedback
   - Real-time validation with React Hook Form
   - MongoDB transactions for data consistency

### Database Schema

**Collections**:
- `users`: User accounts and profiles
- `resumes`: Resume metadata and analysis results
- `jobs`: Job postings and requirements
- `vendors`: Recruitment vendor information
- `applications`: Candidate applications (planned)

### Security Features

- **Authentication**: Firebase Authentication with JWT tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Validation**: Input validation on both client and server
- **Rate Limiting**: API rate limiting to prevent abuse
- **Helmet.js**: Security headers (XSS, CSP, etc.)
- **CORS**: Configured cross-origin resource sharing
- **Environment Variables**: Sensitive data stored in env files

---

## 📸 Screenshots

### Dashboard Overview
![Dashboard](./screenshots/dashboard.png)
*Main dashboard showing key metrics, candidate pipeline, and recent activity*

### AI-Powered Resume Upload & Analysis
![Resume Upload](./screenshots/resume-upload.png)
*Drag-and-drop resume upload with instant AI-powered analysis and skill extraction*

### Job Management
![Jobs Management](./screenshots/jobs-management.png)
*Comprehensive job posting management with filtering and search capabilities*

### Candidate Profile
![Candidate Profile](./screenshots/candidate-profile.png)
*Detailed candidate profile with AI match scoring, timeline, and activity tracking*

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **Git** for version control

You'll also need accounts for:
- [Firebase](https://console.firebase.google.com/) (Authentication)
- [AWS](https://aws.amazon.com/) (S3 bucket)
- [Google AI Studio](https://makersuite.google.com/) (Gemini API key)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/HireNexa.git
   cd HireNexa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory for backend configuration:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your credentials:
   ```env
   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/hirenexa
   # or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hirenexa

   # Firebase Admin SDK
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="your-private-key"
   FIREBASE_CLIENT_EMAIL=your-client-email

   # AWS S3
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=your-bucket-name

   # Google Gemini AI
   GEMINI_API_KEY=your-gemini-api-key

   # Server
   PORT=5000
   NODE_ENV=development
   ```

   Create a `.env.local` file for frontend configuration:
   ```bash
   cp .env.local.example .env.local
   ```

   Update `.env.local`:
   ```env
   # Firebase Client SDK
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

   # API URL
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

4. **Set up Firebase**
   - Create a new project at [Firebase Console](https://console.firebase.google.com/)
   - Enable **Email/Password** authentication
   - Download the service account key (Settings → Service Accounts → Generate New Private Key)
   - Place the JSON file in `misc/` directory and update the path in your code

5. **Set up AWS S3**
   - Create an S3 bucket in your AWS account
   - Configure CORS settings:
     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
         "AllowedOrigins": ["*"],
         "ExposeHeaders": []
       }
     ]
     ```
   - Create IAM user with S3 access and save credentials

6. **Start the development servers**
   ```bash
   # Run both frontend and backend
   npm run dev

   # Or run separately:
   npm run dev:frontend  # Frontend on http://localhost:3000
   npm run dev:server    # Backend on http://localhost:5000
   ```

7. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - Create an admin account (first user is automatically admin)
   - Start exploring HireNexa!

### Building for Production

```bash
# Build both frontend and backend
npm run build

# Start production servers
npm start
```

---

## 🌐 Deployment

### Frontend Deployment (Vercel - Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [Vercel](https://vercel.com/)
   - Import your GitHub repository
   - Configure environment variables (copy from `.env.local`)
   - Deploy!

3. **Alternative: Manual Deployment**
   ```bash
   npm run build:frontend
   # Upload the `.next` folder to your hosting provider
   ```

### Backend Deployment (Render/Railway/Heroku)

#### Option 1: Render (Recommended)

1. Create a new Web Service on [Render](https://render.com/)
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm run build:server`
   - **Start Command**: `npm run start:server`
   - **Environment**: Node
4. Add environment variables from `.env`
5. Deploy!

#### Option 2: Railway

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Deploy:
   ```bash
   railway login
   railway init
   railway up
   ```

3. Add environment variables via Railway dashboard

#### Option 3: Heroku

1. Install Heroku CLI and login:
   ```bash
   heroku login
   ```

2. Create and deploy:
   ```bash
   heroku create hirenexa-api
   git push heroku main
   ```

3. Set environment variables:
   ```bash
   heroku config:set MONGODB_URI=your-mongodb-uri
   heroku config:set GEMINI_API_KEY=your-api-key
   # ... add all other variables
   ```

### Database Deployment (MongoDB Atlas)

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user
3. Whitelist your IP (or use 0.0.0.0/0 for all IPs)
4. Get your connection string
5. Update `MONGODB_URI` in your environment variables

### Environment Variables Checklist

Make sure all these are set in your production environment:
- ✅ `MONGODB_URI`
- ✅ `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
- ✅ `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`
- ✅ `GEMINI_API_KEY`
- ✅ `NEXT_PUBLIC_API_URL` (your backend URL)
- ✅ All `NEXT_PUBLIC_FIREBASE_*` variables

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

## 📝 License

Distributed under the MIT License. See `LICENSE` file for more information.

---

## 👨‍💻 Author

**Darshan Karthikeya**

- GitHub: [@karthikeya1220](https://github.com/karthikeya1220)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/yourprofile)

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Shadcn/UI](https://ui.shadcn.com/) - Beautiful UI Components
- [Firebase](https://firebase.google.com/) - Authentication Platform
- [MongoDB](https://www.mongodb.com/) - Database
- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI Platform
- [AWS](https://aws.amazon.com/) - Cloud Services

---

<div align="center">

**Made with ❤️ by Darshan Karthikeya**

⭐ Star this repo if you find it helpful!

</div>
