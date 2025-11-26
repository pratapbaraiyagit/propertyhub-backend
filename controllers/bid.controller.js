// backend/controllers/bid.controller.js

const Auction = require('../models/Auction.model');
const Bid = require('../models/Bid.model');

// This function creates a bid resource associated with an auction
exports.createBidForAuction = async (req, res) => {
  try {
    // We get the auctionId from the URL parameters
    const { auctionId } = req.params;
    const { amount } = req.body;

    if (!req.user) {
      // This sends a clear error instead of crashing
      return res.status(401).json({ message: "Not authorized, user not found." });
    }
    // The user's ID comes from the 'protect' middleware, NOT the request body
    const userId = req.user.id || req.user._id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== 'Live') {
      return res.status(400).json({ message: "This auction is not live." });
    }

    if (amount <= (auction.highestBid || auction.startBid)) {
      return res.status(400).json({ message: "Bid amount must be higher than the current highest bid." });
    }

    const newBid = new Bid({
      auction_id: auction._id,
      user_id: userId,
      amount
    });
    await newBid.save();

    auction.highestBid = amount;
    await auction.save();

    // You can emit a WebSocket event here to notify clients of the new bid
    // req.io.emit('bidUpdate', { auctionId: auction._id, highestBid: amount, userId });

    res.status(201).json({ message: "Bid placed successfully", bid: newBid });
  } catch (err) {
    console.error("Error placing bid:", err);
    res.status(500).json({ message: "Server error while placing bid" });
  }
};

// You could add other functions here later, e.g.:
// exports.getBidsForAuction = async (req, res) => { ... };