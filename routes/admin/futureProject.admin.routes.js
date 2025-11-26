// backend/routes/admin/futureProject.admin.routes.js
const express = require('express');
const router = express.Router();

const {
    createProject,
    updateProject,
    deleteProject,
    generateCloudinarySignature
} = require('../../controllers/admin/futureProject.admin.controller');

const apartmentUnitAdminRoutes = require('./apartmentUnit.admin.routes');

// Route order is important in Express.js.
// Place specific routes (like PUT and DELETE for a project ID)
// before more general or nested routes.

// Get signature for signed uploads
router.post('/cloudinary-signature', generateCloudinarySignature);

// Create a new project
router.post('/', createProject);

// --- START: Highlighted Edit and Delete Routes ---
// Routes with dynamic :projectId parameter
router.put('/:projectId', updateProject);
router.delete('/:projectId', deleteProject);
// --- END: Highlighted Edit and Delete Routes ---

// Delegate to nested unit routes
router.use('/:projectId/units', apartmentUnitAdminRoutes);


module.exports = router;