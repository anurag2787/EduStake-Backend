const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');

// This function handles POST requests to the root of this router
router.post('/', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not present' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const { content, filename } = req.body;

    let textContent;
    let fileExtension = '';
    
    // Extract file extension from filename
    if (filename) {
      const parts = filename.split('.');
      if (parts.length > 1) {
        fileExtension = parts[parts.length - 1].toLowerCase();
      }
    }

    if (typeof content === 'string') {
      textContent = content;
    } else if (content && content.mimeType && content.content) {
      textContent = `Filename: ${filename}\nContent type: ${content.mimeType}\n`;

      // Handle different file types
      if (content.mimeType === 'text/plain') {
        const decoded = Buffer.from(content.content, 'base64').toString('utf-8');
        textContent += decoded;
      } else if (content.mimeType === 'application/pdf') {
        try {
          // Convert base64 to buffer for PDF processing
          const pdfBuffer = Buffer.from(content.content, 'base64');
          // Parse PDF
          const pdfData = await pdf(pdfBuffer);
          // Add PDF text to content
          textContent += pdfData.text;
        } catch (pdfError) {
          console.error('Error parsing PDF:', pdfError);
          textContent += "[Unable to extract PDF content]";
        }
      } else if (content.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                fileExtension === 'docx') {
        try {
          // Convert base64 to buffer for DOCX processing
          const docxBuffer = Buffer.from(content.content, 'base64');
          // Extract text from DOCX
          const result = await mammoth.extractRawText({ buffer: docxBuffer });
          textContent += result.value;
        } catch (docxError) {
          console.error('Error parsing DOCX:', docxError);
          textContent += "[Unable to extract DOCX content]";
        }
      } else if (content.mimeType.startsWith('image/')) {
        // Handle image files (PNG, JPG, etc.)
        try {
          // Create a worker for OCR
          const worker = await createWorker();
          // Convert base64 to buffer for image processing
          const imageBuffer = Buffer.from(content.content, 'base64');
          // Recognize text in the image
          const { data } = await worker.recognize(imageBuffer);
          // Add extracted text to content
          textContent += data.text;
          // Terminate worker
          await worker.terminate();
        } catch (imageError) {
          console.error('Error extracting text from image:', imageError);
          textContent += "[Unable to extract text from image]";
        }
      } else {
        textContent += "[File content in base64 format - Unable to extract from this file type]";
      }
    } else {
      textContent = `Filename: ${filename}\nUnable to extract content.`;
    }

    // Limit text length for free tier (if necessary)
    const maxLength = 30000; // Adjust based on Gemini free tier limitations
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + "... [content truncated due to length]";
    }

    const prompt = `Analyze the provided document thoroughly and generate a JSON summary that **precisely scales** with the content's depth and volume.  

**Input:**  
- **Document:** ${filename}  
- **Content:** ${textContent}  

**Output Requirements (strict JSON format):**  
\`\`\`json  
{
  "summary": "A **proportionate** overview reflecting the document's length and complexity. For short texts, summarize properly; for lengthy/technical content, include structured details (themes, evidence, conclusions). Never truncate key ideas.",
  "keyPoints": [
    "Extract **all** critical insights (10+ for short docs, 10-20+ for in-depth content). Prioritize:",
    "- Unique claims/data",
    "- Methodologies (if research/technical)",
    "- Controversies/contrasting views",
    "- Explicit conclusions/recommendations"
  ],
  "concepts": {
    "MainTopic1": {
      "description": "Detailed explanation **mirroring the document's depth**",
      "subTopics": {
        "Subtopic1": "Breakdown (omit if irrelevant)",
        "Subtopic2": "Relationships to other concepts"
      }
    }
  }
}
\`\`\`  

**Rules:**  
1. **Content-Adaptive:**  
   - Summary length/detail **must** scale with source material.  
   - Key points should cover **every major section** of long documents.  
2. **Precision:**  
   - Use **direct quotes** for pivotal statements (with page/line numbers if available).  
   - Preserve **data formats** (e.g., "32% growth" → not "significant growth").  
3. **Forbidden:**  
   - No "likely", "could", or hypotheticals.  
   - Never omit due to length — split into logical chunks instead.  
   - No generic statements (e.g., "The document discusses many topics").  

**Example Output for a 100-Page Report:**  
\`\`\`json  
{
  "summary": "Covers 5 years of clinical trials (2018-2023) across 12 countries... [3 more sentences]... Final results show a 47% efficacy rate (±2%) in Phase III trials.",  
  "keyPoints": [
    "Trial design: Double-blind, placebo-controlled (N=4,500)",  
    "Adverse effects: 12% mild, 3% severe (Section 4.2)",  
    "Cost-benefit analysis: $2.1M per QALY gained (Table 3)",  
    "Ethical concerns: Raised in Chapter 6 (informed consent in low-income regions)"  
  ],  
  "concepts": {  
    "Therapeutic Efficacy": {  
      "description": "Primary endpoint: Reduction in symptom severity (p<0.01)",  
      "subTopics": {  
        "Dosage Optimization": "5mg vs. 10mg comparison (Fig. 2.4)",  
        "Demographic Variance": "12% lower response in patients >65yo"  
      }  
    }  
  }  
}  
\`\`\`  
`;  

    // Generate content with the prompt
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          jsonData = JSON.parse(jsonMatch[1].trim());
        } catch (e2) {
          console.error('Failed to parse extracted JSON:', e2);
          throw new Error('Could not parse response as JSON');
        }
      } else {
        // As a fallback, try to extract anything that looks like JSON
        const possibleJson = text.match(/\{[\s\S]*\}/);
        if (possibleJson) {
          try {
            jsonData = JSON.parse(possibleJson[0]);
          } catch (e3) {
            console.error('Failed to parse possible JSON:', e3);
            throw new Error('Could not parse response as JSON');
          }
        } else {
          // Create a structured response if all else fails
          jsonData = {
            summary: `Content extracted from ${filename}, but Gemini API couldn't format response as JSON.`,
            keyPoints: ["File processed but structured summary unavailable"],
            concepts: {}
          };
        }
      }
    }

    // Ensure the response has all required fields
    if (!jsonData.summary) jsonData.summary = `Content extracted from ${filename}`;
    if (!jsonData.keyPoints) jsonData.keyPoints = [];
    if (!jsonData.concepts) jsonData.concepts = {};

    res.json(jsonData);

  } catch (error) {
    console.error('Error in Gemini API route:', error);
    res.status(500).json({
      error: 'Failed to process with Gemini API',
      message: error.message
    });
  }
});

module.exports = router;