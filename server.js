const express = require('express');
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Initialize app
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

dotenv.config();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// Import routes
const geminiRoute = require('./routes/gemniroutes');
const chatRoutes = require('./routes/gemnichat');
const gemniChatRoutes = require('./routes/askgemni');

// Use routes
app.use('/api/gemini-summarize', geminiRoute);
app.use('/api/chat', chatRoutes);
app.use('/api/gemnichat', gemniChatRoutes);

const courseRoutes = require('./routes/courseRoutes');
app.use('/api/courses', courseRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Server is up and running!");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

mongoose
.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Failed to connect to MongoDB', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));