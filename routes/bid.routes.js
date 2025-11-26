// backend/routes/bid.routes.js
const express = require('express');
// CRITICAL: mergeParams allows us to access :auctionId from the parent router
const router = express.Router({ mergeParams: true });

const { createBidForAuction } = require('../controllers/bid.controller');
const { checkAuth } = require('../middleware/auth.middleware');

// This route will be mounted under /api/auctions/:auctionId
// So the full path will be: POST /api/auctions/:auctionId/bids
router.post('/bids', checkAuth, createBidForAuction);

module.exports = router;