// backend/controllers/admin/property.admin.controller.js

const Property = require('../../models/Property.model');
const mongoose = require('mongoose');
const cloudinary = require('../../config/cloudinary');
const streamifier = require('streamifier');

// --- Import the unified notification service ---
const { notifyAllUsers, NEW_PROPERTY } = require('../../utils/notificationService');

// --- FIX 1: Uncomment and enable the Cloudinary upload helper ---
// This function is crucial for uploading image buffers to Cloudinary.
// const uploadToCloudinary = (fileBuffer) => {
//     return new Promise((resolve, reject) => {
//         // Use the same preset as the signature generator for consistency
//         const uploadPreset = process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET; 

//         const stream = cloudinary.uploader.upload_stream(
//             { 
//               upload_preset: uploadPreset, // Correctly use the upload preset
//               folder: 'properties', 
//               resource_type: 'image' 
//             },
//             (error, result) => {
//                 if (error) reject(error);
//                 else resolve(result);
//             }
//         );
//         streamifier.createReadStream(fileBuffer).pipe(stream);
//     });
// };

// const uploadToCloudinary = (fileBuffer) => {
//   return new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder: 'properties', resource_type: 'image' },
//       (error, result) => {
//         if (error) reject(error);
//         else resolve(result);
//       }
//     );
//     streamifier.createReadStream(fileBuffer).pipe(stream);
//   });
// };

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadPreset = process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET;
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'properties',
        resource_type: 'image',
        upload_preset: uploadPreset
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

exports.generateCloudinarySignature = (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadPreset = process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET;

    if (!uploadPreset || !process.env.CLOUDINARY_API_SECRET) {
      console.error("Cloudinary signature failed: Image preset or API secret is not configured.");
      return res.status(500).json({ message: "Server configuration error for uploads." });
    }
    
    const paramsToSign = {
      timestamp: timestamp,
      upload_preset: uploadPreset,
      folder: 'properties'
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: uploadPreset,
      folder: paramsToSign.folder,
    });
  } catch (error) {
    console.error("A fatal error occurred while generating the Cloudinary signature:", error);
    res.status(500).json({ 
      message: "An unexpected error occurred while preparing the file upload.",
    });
  }
};


// @desc    Admin: Create a new property
// @route   POST /api/admin/properties
// @access  Private (Admin)
// exports.createProperty = async (req, res) => {
//     try {
//         const { title, price, address, propertyType } = req.body;

//         if (!title || !price || !address || !propertyType) {
//             return res.status(400).json({ message: 'Title, price, address, and propertyType are required fields.' });
//         }

//         const propertyData = { ...req.body };
        
//         // --- Handle Image Uploads from Buffer ---
//         let imageUrls = [];
//         // The field name 'imageFiles' here must match what you append in the frontend FormData
//         if (req.files && req.files.length > 0) {
//             // The 'uploadToCloudinary' function is now active and will be called here
//             const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
//             const uploadResults = await Promise.all(uploadPromises);
//             imageUrls = uploadResults.map(result => result.secure_url);
//         }

//         propertyData.imageUrls = imageUrls;

//         const newProperty = new Property(propertyData);
//         await newProperty.save();

//         await notifyAllUsers(
//             NEW_PROPERTY,
//             `New property "${newProperty.title}" has been added. Check it out!`
//         );

//         const io = req.app.get('io');
//         io.emit('newPropertyNotification', {
//             title: newProperty.title,
//             propertyId: newProperty._id,
//             message: `New property "${newProperty.title}" has been added.`,
//         });

//         console.log(`[ADMIN CTRL] Property created successfully: ${newProperty.title} (ID: ${newProperty._id})`);
//         res.status(201).json({ message: 'Property created successfully!', property: newProperty });
//     } catch (error) {
//         console.error("Error in createProperty (Admin):", error);
//         if (error.name === 'ValidationError') {
//             const messages = Object.values(error.errors).map(val => val.message);
//             return res.status(400).json({ message: 'Validation Error', errors: messages });
//         }
//         res.status(500).json({ message: "Server error while creating property." });
//     }
// };
exports.createProperty = async (req, res) => {
  try {
    const { title, price, address, propertyType, description, area, bedrooms, district } = req.body;

    if (!title || !price || !address || !propertyType) {
      return res.status(400).json({ message: 'Title, price, address, and propertyType are required.' });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const results = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer)));
      imageUrls = results.map(r => r.secure_url);
    }

    const newProperty = new Property({
      title,
      price,
      address,
      propertyType,
      description,
      area,
      bedrooms,
      district,
      imageUrls
    });

    await newProperty.save();

    await notifyAllUsers(NEW_PROPERTY, `New property "${newProperty.title}" has been added.`);

    const io = req.app.get('io');
    io.emit('newPropertyNotification', {
      title: newProperty.title,
      propertyId: newProperty._id,
      message: `New property "${newProperty.title}" has been added.`,
    });

    res.status(201).json({ message: 'Property created successfully!', property: newProperty });

  } catch (error) {
    console.error('CreateProperty error:', error);
    res.status(500).json({ message: 'Server error while creating property.' });
  }
};


// --- FIX 2: Replace the incorrect updateProperty with the correct version ---
// The following function correctly handles 'multipart/form-data', which is what
// your EditPropertyPage.jsx is sending. It parses JSON data, handles new file
// uploads, and combines old and new image URLs.
// exports.updateProperty = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const propertyData = JSON.parse(req.body.propertyData);
//         const auctionData = JSON.parse(req.body.auctionData);
//         const isAuction = req.body.isAuction === 'yes';
//         const existingImageUrls = JSON.parse(req.body.existingImageUrls || '[]');

//         // --- Handle NEW Image Uploads from Buffer ---
//         let newImageUrls = [];
//         // The field name 'imageFiles' here must match what you append in the frontend FormData
//         if (req.files && req.files.length > 0) {
//             const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
//             const uploadResults = await Promise.all(uploadPromises);
//             newImageUrls = uploadResults.map(result => result.secure_url);
//         }

//         // Combine existing URLs with newly uploaded URLs
//         propertyData.imageUrls = [...existingImageUrls, ...newImageUrls];

//         // Handle auction data
//         if (isAuction) {
//             propertyData.auction = { ...propertyData.auction, ...auctionData };
//         } else {
//             propertyData.auction = undefined;
//         }

//         const updatedProperty = await Property.findByIdAndUpdate(
//             id,
//             { $set: propertyData },
//             { new: true, runValidators: true }
//         );

//         if (!updatedProperty) {
//             return res.status(404).json({ message: 'Property not found.' });
//         }
//         res.json({ message: 'Property updated successfully!', property: updatedProperty });
//     } catch (error) {
//         console.error("!!! FATAL ERROR in updateProperty (Admin):", error);
//         res.status(500).json({ message: "Server error while updating property." });
//     }
// };


exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const propertyData = JSON.parse(req.body.propertyData || '{}');
    const auctionData = JSON.parse(req.body.auctionData || '{}');
    const isAuction = req.body.isAuction === 'yes';
    const existingImageUrls = JSON.parse(req.body.existingImageUrls || '[]');

    let newImageUrls = [];
    if (req.files && req.files.length > 0) {
      const results = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer)));
      newImageUrls = results.map(r => r.secure_url);
    }

    propertyData.imageUrls = [...existingImageUrls, ...newImageUrls];

    if (isAuction) propertyData.auction = { ...propertyData.auction, ...auctionData };
    else propertyData.auction = undefined;

    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      { $set: propertyData },
      { new: true, runValidators: true }
    );

    if (!updatedProperty) return res.status(404).json({ message: 'Property not found.' });

    res.json({ message: 'Property updated successfully!', property: updatedProperty });

  } catch (error) {
    console.error('UpdateProperty error:', error);
    res.status(500).json({ message: 'Server error while updating property.' });
  }
};

// @desc    Admin: Delete a property
// @route   DELETE /api/admin/properties/:id
// @access  Private (Admin)
exports.deleteProperty = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid property ID format.' });
        }

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found.' });
        }

        await property.deleteOne();

        console.log(`[ADMIN CTRL] Property deleted successfully: ${property.title} (ID: ${id})`);
        res.json({ message: 'Property deleted successfully.' });

    } catch (error) {
        console.error("Error in deleteProperty (Admin):", error);
        res.status(500).json({ message: "Server error while deleting property." });
    }
};

// Admin: Get ALL properties regardless of status
exports.getAllPropertiesAdmin = async (req, res) => {
    try {
        const { search, district, sort } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }
        if (district) {
            filter.district = district;
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'district') {
            sortOption = { district: 1 };
        } else if (sort === 'price_asc') {
            sortOption = { price: 1 };
        } else if (sort === 'price_desc') {
            sortOption = { price: -1 };
        }

        const properties = await Property.find(filter).sort(sortOption);
        res.json(properties);

    } catch (error) {
        console.error("Error in getAllPropertiesAdmin:", error);
        res.status(500).json({ message: "Server error while fetching properties." });
    }
};

// Admin: Get a single property regardless of status
exports.getPropertyByIdAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid property ID format.' });
        }
        const property = await Property.findById(id);
        if (!property) return res.status(404).json({ message: "Property not found." });
        res.json(property);
    } catch (error) {
        console.error("Error in getPropertyByIdAdmin:", error);
        res.status(500).json({ message: "Server error." });
    }
};