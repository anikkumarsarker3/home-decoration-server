# Smart Home & Ceremony Decoration Booking System (Backend)

## 📌 Project Overview
This is the **backend server** for **Smart Home & Ceremony Decoration Booking System**.  
The server handles authentication, role-based authorization, service management, booking workflows, decorator assignment, payment processing, and analytics.

It is built using **Node.js, Express, MongoDB**, and **Stripe**, following secure REST API best practices.

---

## 🎯 Responsibilities of the Server
- Secure REST API for client-side operations
- JWT-based authentication & authorization
- Role-based access control (Admin / Decorator / User)
- Booking & service management
- Decorator assignment workflow
- Stripe payment processing
- Analytics & revenue tracking
- Secure environment configuration

---

## ⚙️ Technology Stack

### Backend
- Node.js
- Express.js (v5)
- MongoDB (Native Driver)
- Firebase Admin SDK
- Stripe Payment API
- JSON Web Token (JWT)
- Dotenv
- CORS

---
### 🔐 Environment Variables
Create a .env file in the root directory:
```

MONGODB_uri=your_mongodb_uri
STRIPE_SECRET_KEY=your_stripe_key
FIREBASE_SERVICE_KEY=your_firebase_key
CLIENT_DOMAIN=client_domain
```

## ⚙️ Installation & Run
### Prerequisites
- Node.js (v18+ recommended)
- MongoDB (local or Atlas)
- Stripe account
- Firebase project (Admin SDK enabled)

### Installation
```
git clone https://github.com/anikkumarsarker3/home-decoration-server.git
cd home-decoration-server
npm install
```

### Run Server
```
npm run dev
```


