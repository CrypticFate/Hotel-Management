// backend/routes/adminHotelRoutes.js

const express = require("express");
const router = express.Router();
const db = require("../../dbconn"); // Assuming promise-based DB access
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');

// --- Multer Setup ---
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        // Pass an error to be caught by handleValidationErrors or a dedicated multer error handler
        cb(new Error('File uploaded is not an image.'), false);
    }
};
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// --- Helper: Validation Error Handler ---
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
     // Check for multer errors specifically if needed, or rely on general validation
     const fileError = req.fileValidationError ? [{ param: 'hotelImage', msg: req.fileValidationError.message }] : []; // Example

    if (!errors.isEmpty() || fileError.length > 0) {
        console.error("Validation Errors:", errors.array(), fileError);
        return res.status(400).json({
            success: false,
            error: {
                message: "Validation failed.",
                details: errors.array().concat(fileError).map(err => ({ field: err.param, message: err.msg }))
            }
        });
    }
    next();
};

// --- Validation Rules ---
const hotelIdParamValidation = param('hotelId').isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required.');

const hotelBodyValidation = [
    body('name').trim().notEmpty().withMessage('Hotel name is required.').isLength({ max: 100 }).withMessage('Hotel name too long.'),
    body('description').trim().notEmpty().withMessage('Description is required.'),
    body('starRating').isInt({ min: 1, max: 5 }).withMessage('Star rating must be between 1 and 5.'),
    body('location').custom(value => {
        try {
            const parsed = (typeof value === 'string') ? JSON.parse(value) : value;
            if (typeof parsed !== 'object' || parsed === null || !parsed.city || !parsed.country) { // Basic check
                throw new Error();
            }
            return true;
        } catch (e) {
            throw new Error('Location must be a valid JSON object with at least city and country.');
        }
    }),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status value.')
];

const addHotelValidation = [
    ...hotelBodyValidation,
    // Make image required for add
    body('hotelImage').custom((value, { req }) => {
        if (!req.file) { throw new Error('Hotel image is required.'); }
        return true;
    })
];

const updateHotelValidation = [
     // Make fields optional for update
     body('name').optional().trim().notEmpty().withMessage('Hotel name cannot be empty if provided.').isLength({ max: 100 }),
     body('description').optional().trim().notEmpty().withMessage('Description cannot be empty if provided.'),
     body('starRating').optional().isInt({ min: 1, max: 5 }).withMessage('Star rating must be 1-5.'),
     body('location').optional().custom(value => { /* same validation as above */
         try {
             const parsed = (typeof value === 'string') ? JSON.parse(value) : value;
             if (typeof parsed !== 'object' || parsed === null || !parsed.city || !parsed.country) throw new Error();
             return true;
         } catch (e) { throw new Error('Location must be valid JSON with city and country.'); }
     }),
     // Status update should likely be a separate endpoint (PATCH /hotels/:id/status)
];


// --- Routes ---

/**
 * @route   GET /api/hotels
 * @desc    Get all active hotels
 * @access  Public or Private
 */
router.get("/", async (req, res) => { // Changed from /get-hotels
    // Add query params for filtering by status? e.g., ?status=active (default) or ?status=all
    const requestedStatus = req.query.status || 'active'; // Default to active
    let query = "SELECT HotelID, Name, Description, StarRating, Location, Status, HotelImage FROM Hotel";
    let queryParams = [];

    if (requestedStatus !== 'all') {
         query += " WHERE Status = ?";
         queryParams.push(requestedStatus);
    }
     query += " ORDER BY Name ASC;";

    try {
        const results = await db.query(query, queryParams);
        // Parse Location JSON and convert image Buffer
        const parsedResults = results.map(hotel => {
            let locationData = null;
            try {
                locationData = typeof hotel.Location === "string" ? JSON.parse(hotel.Location) : hotel.Location;
            } catch (e) { console.error(`Error parsing location for HotelID ${hotel.HotelID}:`, e); } // Log error but continue

            return {
                ...hotel,
                Location: locationData,
                HotelImage: hotel.HotelImage ? Buffer.from(hotel.HotelImage).toString('base64') : null
            };
        });
        res.json({ success: true, data: parsedResults });
    } catch (err) {
        console.error("Error fetching hotels:", err);
        res.status(500).json({ success: false, error: { message: "Database error fetching hotels." } });
    }
});

/**
 * @route   POST /api/hotels
 * @desc    Add a new hotel
 * @access  Private (Admin role likely required)
 */
router.post("/",
    upload.single('hotelImage'), // Multer first
    addHotelValidation,         // Validation rules
    handleValidationErrors,     // Handle errors
    async (req, res) => {
        // Note: Status is validated but not explicitly used here, assuming default 'active' or handled by DB/validation
        const { name, description, starRating, location, status = 'active' } = req.body;
        const hotelImage = req.file.buffer; // Already validated that file exists

        // Ensure location is stringified for DB insert if column type is TEXT/VARCHAR
        const locationString = (typeof location === 'object') ? JSON.stringify(location) : location;

        const sql = "INSERT INTO Hotel (Name, Description, StarRating, Location, Status, HotelImage) VALUES (?, ?, ?, ?, ?, ?)";
        try {
             // Check for duplicate name?
             const checkQuery = 'SELECT 1 FROM Hotel WHERE LOWER(Name) = LOWER(?)';
             const [existing] = await db.query(checkQuery, [name]);
             if (existing.length > 0) {
                 return res.status(409).json({ success: false, error: { message: `Hotel with name '${name}' already exists.` } });
             }

            const result = await db.query(sql, [name, description, starRating, locationString, status, hotelImage]);
            res.status(201).json({ success: true, message: "Hotel added successfully", data: { hotelId: result.insertId } });
        } catch (err) {
            console.error("Error adding hotel:", err);
             if (err.code === 'ER_DUP_ENTRY') {
                  return res.status(409).json({ success: false, error: { message: `Hotel with name '${name}' likely already exists.` } });
             }
            res.status(500).json({ success: false, error: { message: "Database error adding hotel." } });
        }
});

/**
 * @route   PATCH /api/hotels/:hotelId/status
 * @desc    Update hotel status (e.g., activate/deactivate)
 * @access  Private (Admin role likely required)
 */
router.patch("/:hotelId/status",
    hotelIdParamValidation,
    [ body('status').isIn(['active', 'inactive']).withMessage('Status must be "active" or "inactive".') ], // Validate status in body
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { status } = req.body; // Get new status from body

        const sql = "UPDATE Hotel SET Status = ? WHERE HotelID = ?";
        try {
            const [result] = await db.query(sql, [status, hotelId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: { message: "Hotel not found." } });
            }
            res.status(200).json({ success: true, message: `Hotel status updated to ${status}.` });
        } catch (err) {
            console.error(`Error updating hotel ${hotelId} status:`, err);
            res.status(500).json({ success: false, error: { message: "Database error updating hotel status." } });
        }
});


/**
 * @route   PUT /api/hotels/:hotelId
 * @desc    Update hotel details
 * @access  Private (Admin role likely required)
 */
router.put("/:hotelId",
    upload.single('hotelImage'), // Multer first
    hotelIdParamValidation,     // Param validation
    updateHotelValidation,      // Body validation (optional fields)
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { name, description, starRating, location } = req.body;
        const hotelImageBuffer = req.file ? req.file.buffer : undefined;

        let fieldsToUpdate = [];
        let queryParams = [];

        if (name !== undefined) { fieldsToUpdate.push("Name = ?"); queryParams.push(name); }
        if (description !== undefined) { fieldsToUpdate.push("Description = ?"); queryParams.push(description); }
        if (starRating !== undefined) { fieldsToUpdate.push("StarRating = ?"); queryParams.push(starRating); }
        if (location !== undefined) {
             // Ensure location is stringified for DB
             const locationString = (typeof location === 'object') ? JSON.stringify(location) : location;
             fieldsToUpdate.push("Location = ?");
             queryParams.push(locationString);
        }
        if (hotelImageBuffer !== undefined) { fieldsToUpdate.push("HotelImage = ?"); queryParams.push(hotelImageBuffer); }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, error: { message: "No fields provided for update." } });
        }

        const sql = `UPDATE Hotel SET ${fieldsToUpdate.join(', ')} WHERE HotelID = ?`;
        queryParams.push(hotelId);

        try {
            // Check for duplicate name if name is being changed
            if (name !== undefined) {
                 const checkQuery = 'SELECT 1 FROM Hotel WHERE LOWER(Name) = LOWER(?) AND HotelID <> ?';
                 const [existing] = await db.query(checkQuery, [name, hotelId]);
                 if (existing.length > 0) {
                     return res.status(409).json({ success: false, error: { message: `Another hotel with name '${name}' already exists.` } });
                 }
            }

            const [result] = await db.query(sql, queryParams);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: { message: "Hotel not found or no changes made." } });
            }
            res.status(200).json({ success: true, message: "Hotel updated successfully." });
        } catch (err) {
            console.error("Error updating hotel:", err);
             if (err.code === 'ER_DUP_ENTRY') {
                  return res.status(409).json({ success: false, error: { message: `Update failed: Hotel name '${name}' may already exist.` } });
             }
            res.status(500).json({ success: false, error: { message: "Database error updating hotel." } });
        }
});

/**
 * @route   DELETE /api/hotels/:hotelId
 * @desc    Delete a hotel (Use with extreme caution!)
 * @access  Private (HIGHLY restricted - Admin only)
 */
router.delete("/:hotelId",
    hotelIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;

        // !! DANGER ZONE !! Deleting a hotel likely requires cascading deletes or checks across MANY tables (Bookings, Employees, Departments, Inventory, Transactions, etc.)
        // A simple DELETE FROM Hotel is unlikely to work due to foreign key constraints and is generally a bad idea.
        // Consider soft delete (setting status to 'deleted') or a complex cleanup procedure.
        // This example implements a basic check and delete, but **this is NOT production-ready for delete**.

        // Example Check (Very basic - needs expansion): Check for any active employees in this hotel
        const checkEmployeeQuery = `SELECT 1 FROM Employee e JOIN Department d ON e.DeptID = d.DeptID WHERE d.HotelID = ? AND e.working_status = 'Working' LIMIT 1`;
        // Add checks for active bookings, etc.

        const deleteQuery = `DELETE FROM Hotel WHERE HotelID = ?`; // The actual delete

        // Use Transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
             const [activeEmployees] = await connection.query(checkEmployeeQuery, [hotelId]);
             if (activeEmployees.length > 0) {
                 await connection.rollback();
                 return res.status(409).json({ success: false, error: { message: "Cannot delete hotel with active employees. Please reassign or deactivate employees first." } });
             }
             // Add more checks here (bookings, inventory, etc.)

            // If all checks pass, proceed with delete
            const [result] = await connection.query(deleteQuery, [hotelId]);

            if (result.affectedRows === 0) {
                 await connection.rollback();
                 return res.status(404).json({ success: false, error: { message: "Hotel not found." } });
            }

            await connection.commit();
            res.status(200).json({ success: true, message: "Hotel deleted successfully (Use with caution!)." });

        } catch (err) {
            await connection.rollback();
            console.error("Error deleting hotel:", err);
            // Handle foreign key constraint errors specifically
             if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
                  return res.status(409).json({ success: false, error: { message: "Cannot delete hotel because it is referenced in other essential records." } });
             }
            res.status(500).json({ success: false, error: { message: "Database error deleting hotel." } });
        } finally {
            connection.release();
        }
});


module.exports = router;