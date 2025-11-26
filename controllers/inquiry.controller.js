// backend/controllers/inquiry.controller.js
const Inquiry = require('../models/Inquiry.model');

// @desc    Create a new inquiry or pre-registration
// @route   POST /api/inquiries
// @access  Public
exports.createInquiry = async (req, res) => {

    // Debug: Log incoming request
    console.log('[INQUIRY] Incoming body:', req.body);
    console.log('[INQUIRY] loggedInUser:', req.loggedInUser);

    const { projectId, message } = req.body;
    const email = req.loggedInUser && req.loggedInUser.email;

    // Validate fields
    if (!email || !projectId || !message || typeof message !== 'string' || !message.trim()) {
        console.warn('[INQUIRY] 400 error - missing or invalid field(s):', { email, projectId, message });
        return res.status(400).json({ message: 'email, projectId, and message are required.' });
    }

    try {
        const newInquiry = new Inquiry({
            email,
            projectId,
            message: message.trim()
        });

        await newInquiry.save();
        console.log(`[INQUIRY] New inquiry received for project ${projectId} from user ${email}`);
        res.status(201).json({ message: 'Thank you for your inquiry! We will be in touch shortly.' });
    } catch (error) {
        console.error('[INQUIRY] Error saving inquiry:', error);
        res.status(500).json({ message: 'Server error while submitting your inquiry.' });
    }
};