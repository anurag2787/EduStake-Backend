const express = require('express');
const router = express.Router();
const UserCourse = require('../models/UserCourse');

// Enroll in a course
router.post('/enroll', async (req, res) => {
    try {
      const { userId, courseId, stakeAmount } = req.body;
  
      // Validate required fields
      if (!userId || !courseId || !stakeAmount) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      // Find user's course document
      let userCourse = await UserCourse.findOne({ userId });
  
      // If user doesn't have any course document yet, create one
      if (!userCourse) {
        userCourse = new UserCourse({ userId, courses: [] });
      }
  
      // Check if already enrolled in this course
      const alreadyEnrolled = userCourse.courses.some(
        course => course.courseId === courseId
      );
      
      if (alreadyEnrolled) {
        return res.status(400).json({ message: 'Already enrolled in this course' });
      }
  
      // Add new course enrollment
      userCourse.courses.push({
        courseId,
        stakeAmount
      });
  
      await userCourse.save();
  
      res.status(201).json({
        message: 'Successfully enrolled in course',
        course: {
          courseId,
          stakeAmount
        }
      });
    } catch (error) {
      if (error.code === 11000) { // MongoDB duplicate key error
        return res.status(400).json({ message: 'Already enrolled in this course' });
      }
      res.status(500).json({ 
        message: 'Error enrolling in course', 
        error: error.message 
      });
    }
  });

// Mark video as completed
router.post('/progress', async (req, res) => {
    try {
      const { userId, courseId, videoId } = req.body;
  
      // Validate input
      if (!userId || !courseId || !videoId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }
  
      // Find user's course document
      const userCourse = await UserCourse.findOne({ userId });
      if (!userCourse) {
        return res.status(404).json({ success: false, message: 'User not enrolled in any courses' });
      }
  
      // Find the specific course
      const course = userCourse.courses.find(c => c.courseId === courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: 'User not enrolled in this course' });
      }
  
      // Find video progress
      let video = course.videos.find(v => v.videoId === videoId);
  
      if (!video) {
        // If video not found, add it as completed
        course.videos.push({ videoId, completed: true });
      } else {
        // Update existing video progress
        video.completed = true;
      }
  
      // Check if all videos are completed
      const allVideosCompleted = course.videos.length > 0 && course.videos.every(v => v.completed);
      course.completed = allVideosCompleted;
  
      // Save changes
      userCourse.markModified('courses'); // Important for nested arrays
      await userCourse.save();
  
      // Send response
      res.json({
        success: true,
        message: 'Video progress updated',
        data: {
          videoId,
          completed: true,
          courseCompleted: course.completed,
          progress: {
            completed: course.videos.filter(v => v.completed).length,
            total: course.videos.length
          }
        }
      });
  
    } catch (error) {
      console.error('Progress update error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating progress',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
  

// Get user's course progress
router.get('/progress/:userId/:courseId', async (req, res) => {
    try {
      const { userId, courseId } = req.params;
  
      const userCourse = await UserCourse.findOne({ userId });
      if (!userCourse) {
        return res.status(404).json({ message: 'User not found or not enrolled in any courses' });
      }
  
      const course = userCourse.courses.find(c => c.courseId === courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found for this user' });
      }
  
      res.json({
        courseId: course.courseId,
        videos: course.videos,
        courseCompleted: course.completed,
        courseCompletedAt: course.completedAt
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching course videos', error: error.message });
    }
  });

module.exports = router;