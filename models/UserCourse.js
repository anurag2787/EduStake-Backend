const mongoose = require('mongoose');

const videoProgressSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  completed: { type: Boolean, default: false }
});

const enrolledCourseSchema = new mongoose.Schema({
  courseId: { type: String, required: true },
  stakeAmount: { type: String, required: true },
  videos: [videoProgressSchema]
});

const userCourseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  courses: [enrolledCourseSchema]
});

// Create compound index to prevent duplicate course enrollments for same user
userCourseSchema.index({ userId: 1, "courses.courseId": 1 }, { unique: true });

module.exports = mongoose.model('UserCourse', userCourseSchema);