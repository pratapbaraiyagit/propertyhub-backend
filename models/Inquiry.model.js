const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  email: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'FutureApartmentProject', required: true },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', inquirySchema);
