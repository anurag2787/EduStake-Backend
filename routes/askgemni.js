
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const express = require('express');
const router = express.Router();

// Load environment variables
dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// Helper function to parse Gemini response
const parseGeminiResponse = (text) => {
  try {
    // Look for JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If not found, try parsing the entire text as JSON
    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    throw new Error("Unable to parse Gemini response as valid JSON");
  }
};

// Route to handle Gemini API requests
router.post('/', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Configure the model - use the text model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse the response to get JSON data
    const parsedData = parseGeminiResponse(text);
    
    // Validate the response has the expected format
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      throw new Error("Invalid response format from Gemini");
    }
    
    // Check that each question has the required fields
    parsedData.forEach((question, index) => {
      if (!question.question || !Array.isArray(question.options) || 
          question.correct === undefined || question.correct === null) {
        throw new Error(`Question ${index + 1} has missing or invalid fields`);
      }
    });

    res.json(parsedData);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: error.message || 'Error generating content' });
  }
});

module.exports = router;