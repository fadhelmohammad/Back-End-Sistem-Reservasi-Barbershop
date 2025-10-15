// server.js
require('dotenv').config(); // Tambahkan di paling atas

const express = require("express");
const connectDB = require("./app/config/db");
const userRoutes = require("./app/routes/userRoutes");
const barberRoutes = require("./app/routes/barberRoutes");
const scheduleRoutes = require("./app/routes/scheduleRoutes");
const reservationRoutes = require("./app/routes/reservationRoutes");
const packageRoutes = require("./app/routes/packageRoutes");
const dashboardRoutes = require("./app/routes/dashboardRoutes");
const cashierRoutes = require("./app/routes/cashierRoutes");
const cors = require("cors");


// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
    res.send("Hello World")
});
app.use("/api/users", userRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/barbers", barberRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/cashiers", cashierRoutes);

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
