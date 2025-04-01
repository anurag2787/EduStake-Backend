const express = require('express');
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
// const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const geminiRoute = require('./routes/gemniroutes.js'); // Make sure this path is correct
const chatRoutes = require('./routes/gemnichat.js'); // Make sure this path is correct

app.use(cors({
  origin: '*', // Allow requests from any origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
dotenv.config();

// Add this before your routes
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increase URL-encoded payload limit
app.use(bodyParser.json({ limit: '50mb' })); // Also increase bodyParser limit

// Connect the route handler to the /api/gemini-summarize endpoint
app.use('/api/gemini-summarize', geminiRoute);
app.use('/api/chat', chatRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Server is up and running! Are you a developer? 😏 I bet you didn't even check before panicking. Relax, it's all good! 🎉😂");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong on the server"
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});