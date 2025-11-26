const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiry.controller');
const { checkAuth } = require('../middleware/auth.middleware');

// Only logged-in users can submit inquiries
router.post('/', checkAuth, inquiryController.createInquiry);

module.exports = router;
