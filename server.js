// server.js
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./app/config/db");
const userRoutes = require("./app/routes/userRoutes");
const barberRoutes = require("./app/routes/barberRoutes");
const scheduleRoutes = require("./app/routes/scheduleRoutes");
const reservationRoutes = require("./app/routes/reservationRoutes");
const cors = require("cors");


// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
    res.send("Hello World")
});
app.use("/api/users", userRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/barbers", barberRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
