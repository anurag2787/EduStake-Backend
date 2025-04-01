const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// POST endpoint for chat interactions
router.post('/', async (req, res) => {
  try {
    // Extract message and history from request body
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize API with key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro" });

    // Simpler approach - convert history to Gemini format
    const chatHistory = [];
    
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        const role = msg.role === 'user' ? 'user' : 'model';
        chatHistory.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
    }

    // Start chat session with history
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    });

    // Send user message and get response
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // Return the AI response with timestamp matching frontend format
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    res.json({
      message: responseText,
      timestamp: currentTime
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    
    // Return a user-friendly error message
    res.status(500).json({
      message: "I'm sorry, I encountered an error processing your request. Please try again."
    });
  }
});

module.exports = router;