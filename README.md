# 🚗 Carpool Finder

> **Share your ride. Save money. Travel together.**

A full-stack web application that connects drivers with empty seats to riders heading the same way. Built for university students and office employees who want to split travel costs and reduce traffic.

<p align="center">
  <a href="https://carpool-finder-vlgv.onrender.com"><strong>🌐 Live Demo</strong></a> ·
  <a href="https://github.com/weZnaz/carpool-finder/issues"><strong>🐛 Report Bug</strong></a> ·
  <a href="https://github.com/weZnaz/carpool-finder/issues"><strong>✨ Request Feature</strong></a>
</p>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Database Schema](#-database-schema)
- [API Endpoints](#-api-endpoints)
- [Business Rules](#-business-rules)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Installation](#local-installation)
  - [Environment Variables](#environment-variables)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)
- [Acknowledgments](#-acknowledgments)

---

## 🎯 About the Project

**Carpool Finder** is a peer-to-peer ride-sharing platform built from scratch as a learning project. Unlike commercial services (Uber, Pathao), it's focused on **splitting costs** among people who are already going the same way — colleagues, classmates, and neighbors.

### The Problem

- 🚗 Private cars travel with empty seats daily
- 💸 Solo rides are expensive (fuel, tolls, CNG fares)
- 🚦 Traffic congestion keeps increasing
- 🤝 No trusted platform for peers to coordinate shared rides

### The Solution

A simple, clean web app where:

- **Drivers** post trips with available seats
- **Riders** search for trips and request seats
- **Drivers** accept or reject requests
- **Everyone** saves money and travels together

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| **Frontend + API** | [https://carpool-finder-vlgv.onrender.com](https://carpool-finder-vlgv.onrender.com) |
| **Health Check** | [https://carpool-finder-vlgv.onrender.com/api/health](https://carpool-finder-vlgv.onrender.com/api/health) |
| **GitHub Repository** | [https://github.com/weZnaz/carpool-finder](https://github.com/weZnaz/carpool-finder) |

> ⏳ **Note:** The app is hosted on Render's free tier. If it hasn't been visited in 15+ minutes, the first load may take 30–60 seconds to wake up. Subsequent visits are instant.

---

## ✨ Features

### For Drivers
- ✅ Post a trip with route, date, time, seats, and vehicle info
- ✅ View all rider requests for each trip
- ✅ Accept or reject requests
- ✅ Cancel a trip
- ✅ See available seats update automatically

### For Riders
- ✅ Search trips by origin, destination, and date
- ✅ View detailed trip information
- ✅ Request a seat with a personal message
- ✅ Track request status (pending / accepted / rejected)
- ✅ Cancel a request

### General
- ✅ User registration and login (JWT authentication)
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Password hashing with bcrypt
- ✅ Protected API routes
- ✅ Persistent data in cloud MySQL

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| HTML5 | Semantic markup |
| CSS3 | Custom design system (no frameworks) |
| Vanilla JavaScript | UI logic and DOM manipulation |
| Fetch API | HTTP requests to backend |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Web framework and REST API |
| JWT (jsonwebtoken) | Stateless authentication |
| bcryptjs | Password hashing |
| mysql2 | MySQL driver with promise support |
| dotenv | Environment variable management |
| cors | Cross-origin resource sharing |

### Database
| Technology | Purpose |
|---|---|
| MySQL 8.4 | Relational database |
| Aiven | Cloud MySQL hosting with SSL |

### DevOps
| Tool | Purpose |
|---|---|
| Git | Version control |
| GitHub | Code hosting |
| Render | Backend + frontend hosting |
| Aiven | Database hosting |

---

## 🏗️ System Architecture

```


USER
│
↓
WEB BROWSER
│
↓
HTML/CSS/JavaScript
│
│ fetch()
↓
REST API
│
↓
Node.js + Express
│
│ SQL
↓
Aiven MySQL (Cloud)


```
### Why this architecture?

- **Separation of concerns** — Frontend never touches the database directly
- **Security** — All database access goes through authenticated API routes
- **Scalability** — Each layer can be scaled independently
- **Maintainability** — Clear boundaries between concerns

---

## 🗄️ Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Primary key |
| `name` | VARCHAR(100) | User's full name |
| `email` | VARCHAR(150) | Unique login identifier |
| `password` | VARCHAR(255) | bcrypt-hashed |
| `phone` | VARCHAR(20) | Optional contact |
| `role` | ENUM | `driver` / `rider` / `both` |
| `created_at` | TIMESTAMP | Auto-set |

### `trips`

| Column | Type | Notes |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Primary key |
| `driver_id` | INT | Foreign key → users.id |
| `start_location` | VARCHAR(150) | Origin |
| `destination` | VARCHAR(150) | Destination |
| `trip_date` | DATE | Trip date |
| `departure_time` | TIME | Departure time |
| `available_seats` | INT | Remaining seats |
| `vehicle` | VARCHAR(150) | Car make/model |
| `notes` | TEXT | Additional info |
| `status` | ENUM | `active` / `completed` / `cancelled` |
| `created_at` | TIMESTAMP | Auto-set |

### `ride_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | INT AUTO_INCREMENT | Primary key |
| `trip_id` | INT | Foreign key → trips.id |
| `rider_id` | INT | Foreign key → users.id |
| `message` | TEXT | Rider's note to driver |
| `status` | ENUM | `pending` / `accepted` / `rejected` / `cancelled` |
| `created_at` | TIMESTAMP | Auto-set |

### Relationships

```


users (1) ──────< trips (many)
│
│
↓
ride_requests (many)
↑
│
users (1) ──────────┘


```
- One driver → many trips
- One trip → many ride requests
- One rider → many ride requests
- Unique constraint on `(trip_id, rider_id)` — no duplicate requests

---

## 🔌 API Endpoints

### Base URL
```


[https://carpool-finder-vlgv.onrender.com/api](https://carpool-finder-vlgv.onrender.com/api)


```
### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create new account |
| `POST` | `/auth/login` | Public | Log in, get JWT token |
| `GET` | `/auth/me` | 🔒 Required | Get current user profile |

### Trips

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/trips` | Public | List all active trips (with filters) |
| `GET` | `/trips/:id` | Public | Get a single trip |
| `POST` | `/trips` | 🔒 Required | Create a new trip |
| `PUT` | `/trips/:id` | 🔒 Owner only | Update a trip |
| `DELETE` | `/trips/:id` | 🔒 Owner only | Cancel a trip |

**Query parameters for `/trips`:**
```


GET /api/trips?from=Dhaka&to=Savar&date=2026-10-10


```
### Ride Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/trips/:tripId/requests` | 🔒 Required | Request a seat |
| `GET` | `/trips/:tripId/requests` | 🔒 Driver only | Get all requests for a trip |
| `PUT` | `/requests/:id/accept` | 🔒 Driver only | Accept a request |
| `PUT` | `/requests/:id/reject` | 🔒 Driver only | Reject a request |
| `DELETE` | `/requests/:id` | 🔒 Rider only | Cancel own request |

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server + DB status |

---

## ⚙️ Business Rules

The application enforces these rules on the backend:

| # | Rule | Reason |
|---|---|---|
| 1 | Driver cannot request their own trip | Prevents self-dealing |
| 2 | No request if `available_seats = 0` | Prevents overbooking |
| 3 | Accepting a request decrements seats by 1 | Keeps count accurate |
| 4 | Cannot accept more requests than seats | Prevents overbooking |
| 5 | A rider cannot request the same trip twice | DB unique constraint |
| 6 | Only the trip's driver can accept/reject requests | Authorization |
| 7 | Cancelled trips disappear from search | Clean UX |
| 8 | Passwords are bcrypt-hashed (10 rounds) | Never store plaintext |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have these installed:

- **Node.js** (v18 or later) — [Download](https://nodejs.org)
- **npm** (comes with Node.js)
- **MySQL** (v8 or later) — [Download](https://dev.mysql.com/downloads/)
- **Git** — [Download](https://git-scm.com)
- **VS Code** (recommended) — [Download](https://code.visualstudio.com)

### Local Installation

**1. Clone the repository**
```bash
git clone https://github.com/weZnaz/carpool-finder.git
cd carpool-finder
```


**2. Set up the database**


```
mysql -u root -p < database/schema.sql
```


Or open MySQL Workbench and run the contents of `database/schema.sql`.

**3. Install backend dependencies**


```
cd backend
npm install
```


**4. Configure environment variables**

Create `backend/.env`:


```
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=carpool_finder

JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
```


**5. Start the backend**


```
npm run dev
```


You should see:


```
✅ MySQL connected successfully
🚀 Server running at http://localhost:3000
```


**6. Open the frontend**

Open `frontend/index.html` in your browser, or use the **Live Server** extension in VS Code.

The frontend expects the API at `http://localhost:3000/api`.

### Environment Variables

| **Variable**     | **Description**           | **Example**                      |
| :--------------- | :------------------------ | :------------------------------- |
| `PORT`           | Server port               | `3000`                           |
| `DB_HOST`        | MySQL host                | `localhost`                      |
| `DB_PORT`        | MySQL port                | `3306`                           |
| `DB_USER`        | MySQL user                | `root`                           |
| `DB_PASSWORD`    | MySQL password            | `secret`                         |
| `DB_NAME`        | Database name             | `carpool_finder`                 |
| `DB_SSL`         | Use SSL for DB            | `false` (local) / `true` (cloud) |
| `JWT_SECRET`     | Secret for signing tokens | long random string               |
| `JWT_EXPIRES_IN` | Token lifetime            | `7d`                             |

---

## 🌍 Deployment

The application is deployed across three services:

| **Layer**          | **Service**                   | **Notes**                            |
| :----------------- | :---------------------------- | :----------------------------------- |
| Frontend + Backend | [Render](https://render.com/) | Auto-deploys on `git push` to `main` |
| Database           | [Aiven](https://aiven.io/)    | Cloud MySQL with SSL                 |
| Source Code        | [GitHub](https://github.com/) | Version control                      |

### Deployment Flow


```
Local development
      ↓
git push origin main
      ↓
GitHub repository updated
      ↓
Render detects new commit
      ↓
Render builds + deploys
      ↓
Live at carpool-finder-vlgv.onrender.com
```


### Render Blueprint

The project includes a `render.yaml` blueprint for one-click deployment. To deploy your own copy:

1. Fork this repository
2. Go to [Render Dashboard](https://dashboard.render.com/) → **New +** → **Blueprint**
3. Connect your fork
4. Fill in the environment variables (see Environment Variables)
5. Click **Apply**

See [DEPLOYMENT.md](https://deployment.md/) for the full step-by-step guide.

---

## 📁 Project Structure


```
carpool-finder/
│
├── frontend/                    # Static site (served by Express)
│   ├── index.html               # Landing page
│   ├── login.html               # Login form
│   ├── register.html            # Registration form
│   ├── rides.html               # Search & browse trips
│   ├── ride-details.html        # Single trip view
│   ├── offer-ride.html          # Driver posts a trip
│   ├── dashboard.html           # User's trips & requests
│   ├── requests.html            # Driver's request inbox
│   │
│   ├── css/
│   │   └── style.css            # Full design system
│   │
│   └── js/
│       ├── auth.js              # Login/register logic
│       ├── rides.js             # Search & list trips
│       ├── ride-details.js      # Trip detail + request
│       ├── offer-ride.js        # Trip creation form
│       ├── dashboard.js         # User dashboard
│       └── requests.js          # Accept/reject handling
│
├── backend/                     # Express API
│   ├── server.js                # Entry point
│   ├── package.json
│   ├── .env                     # (not committed — see .env.example)
│   │
│   ├── config/
│   │   └── database.js          # MySQL connection pool
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── tripRoutes.js
│   │   └── requestRoutes.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── tripController.js
│   │   └── requestController.js
│   │
│   └── middleware/
│       └── authMiddleware.js    # JWT verification
│
├── database/
│   └── schema.sql               # Full DB schema
│
├── render.yaml                  # Render blueprint
├── DEPLOYMENT.md                # Deployment guide
├── README.md                    # This file
└── .gitignore
```


---

## 📸 Screenshots

### 🏠 Homepage

[https://docs/screenshots/homepage.png](https://docs/screenshots/homepage.png)

### 🔍 Find a Ride

[https://docs/screenshots/find-ride.png](https://docs/screenshots/find-ride.png)

### 🚗 Trip Details

[https://docs/screenshots/trip-details.png](https://docs/screenshots/trip-details.png)

### 📝 Offer a Ride

[https://docs/screenshots/offer-ride.png](https://docs/screenshots/offer-ride.png)

### 📊 Dashboard

[https://docs/screenshots/dashboard.png](https://docs/screenshots/dashboard.png)

### 📬 Driver Requests

[https://docs/screenshots/requests.png](https://docs/screenshots/requests.png)

> 📌 **Note to contributors:** Screenshots live in `docs/screenshots/`. To update, take fresh ones and commit them.

---

## 🗺️ Roadmap

### Version 1.0 (Current) ✅

- ☑ 

  User authentication (JWT + bcrypt)
- ☑ 

  Trip creation & management
- ☑ 

  Trip search with filters
- ☑ 

  Ride requests (create, accept, reject, cancel)
- ☑ 

  Responsive design
- ☑ 

  Cloud deployment

### Version 2.0 (Planned)

- □ 

  Real-time chat between driver and rider
- □ 

  Online payment integration (bKash / Stripe)
- □ 

  Rating & review system
- □ 

  Email notifications
- □ 

  Google Maps integration
- □ 

  Push notifications
- □ 

  Profile photos and verification

### Version 3.0 (Future)

- □ 

  AI-powered ride matching
- □ 

  Mobile app (React Native)
- □ 

  Multi-language support
- □ 

  Advanced admin dashboard
- □ 

  Analytics & reporting

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. **Fork** the repository
2. **Create** a branch: `git checkout -b feature/AmazingFeature`
3. **Commit** changes: `git commit -m "Add some AmazingFeature"`
4. **Push** to branch: `git push origin feature/AmazingFeature`
5. **Open** a Pull Request

Please make sure to update tests as appropriate and follow the existing code style.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](https://license/) for more information.


```
MIT License

Copyright (c) 2026 Syed Nazmul Islam Ramim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


---

## 📬 Contact

**Syed Nazmul Islam Ramim**

- 🐙 GitHub: [@weZnaz](https://github.com/weZnaz)
- 📧 Email: syednazmulislamramim@gmail.com
- 💼 LinkedIn: [linkedin.com/in/yourprofile](https://linkedin.com/in/weznaz)

**Project Link:** https://github.com/weZnaz/carpool-finder

---

##  Acknowledgments

- [Node.js](https://nodejs.org/) — JavaScript runtime
- [Express](https://expressjs.com/) — Web framework
- [MySQL](https://www.mysql.com/) — Database
- [Aiven](https://aiven.io/) — Cloud MySQL hosting
- [Render](https://render.com/) — App hosting
- [Shields.io](https://shields.io/) — Badges


---

<p align="center"><strong>Built with ❤️ by <a href="https://github.com/weZnaz">Syed Nazmul Islam Ramim</a></strong><br><em>⭐ Star this repo if you found it useful!</em></p>
