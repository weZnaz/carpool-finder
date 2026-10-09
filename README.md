# 🚗 Carpool Finder

**Share your ride. Save money. Travel together.**

Carpool Finder is a ride-sharing web application that connects drivers with available seats to riders traveling in the same direction. It helps university students and office employees share travel costs and make commuting easier.

🌐 **[Live Demo](https://carpool-finder-vlgv.onrender.com)** · **[GitHub Repository](https://github.com/weZnaz/carpool-finder)**

## ✨ Features

* 🔐 User registration and login
* 🚗 Post and manage trips
* 🔍 Search rides by location and date
* 🪑 Request seats on available trips
* ✅ Accept or reject ride requests
* 📊 Dashboard to manage trips and requests
* 📱 Responsive design for mobile and desktop
* ☁️ Cloud database and deployment

## 🛠️ Technologies

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express.js
* **Database:** MySQL
* **Authentication:** JWT, bcrypt
* **Deployment:** Render, Aiven
* **Version Control:** Git, GitHub

## 🚀 Getting Started

### Prerequisites

* Node.js (v18 or later)
* MySQL (v8 or later)
* Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/weZnaz/carpool-finder.git
   cd carpool-finder
   ```

2. Create the database using `database/schema.sql`.

3. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

4. Create a `.env` file inside the `backend` folder:

   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=carpool_finder
   JWT_SECRET=your_secret_key
   JWT_EXPIRES_IN=7d
   ```

5. Start the server:

   ```bash
   npm run dev
   ```

6. Open `frontend/index.html` in your browser or use VS Code Live Server.

## 📸 Screenshots
<img width="1822" height="915" alt="image" src="https://github.com/user-attachments/assets/fb7037a0-1a0b-4d11-bff0-eb97b70d1e17" /><br>

<img width="1872" height="905" alt="image" src="https://github.com/user-attachments/assets/e84ebbec-bf77-4501-b368-a91d0671926e" /><br>
<img width="1837" height="891" alt="image" src="https://github.com/user-attachments/assets/739f4d0a-53c0-4de4-bfdc-2f3cf5a9c71c" />

## 🗺️ Future Improvements

* Real-time chat
* Rating and review system
* Email notifications
* Google Maps integration
* Online payment integration

## 👨‍💻 Author

**Syed Nazmul Islam Ramim**

* GitHub: [@weZnaz](https://github.com/weZnaz)
* LinkedIn: [LinkedIn Profile](https://www.linkedin.com/in/weznaz/)

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

⭐ If you find this project useful, consider giving it a star!
