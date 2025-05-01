// backend/routes/roomsRoute.js

const express = require("express");
const router = express.Router();
const db = require("../../dbconn"); // Assuming promise-based
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');

// --- Multer Setup ---
// Configure memory storage (good for small files, consider disk storage for large images)
const storage = multer.memoryStorage();
// Add file filter if needed (e.g., only allow images)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // Example: 5MB limit

// --- Helper Function for Validation Errors ---
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error("Validation Errors:", errors.array());
        // Multer might add file errors to req.fileValidationError
        const fileError = req.fileValidationError ? [{ param: 'roomImage', msg: req.fileValidationError.message }] : [];
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
const hotelIdParamValidation = param('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required.');
const roomIdParamValidation = param('roomID').isInt({ gt: 0 }).withMessage('Valid Room ID parameter is required.');

const roomClassIdValidation = body('roomClassID').isInt({ gt: 0 }).withMessage('Valid Room Class ID is required.');
const basePriceValidation = body('basePrice').isFloat({ gt: 0 }).withMessage('Base price must be a positive number.');
const maxOccupancyValidation = body('maxOccupancy').isInt({ gt: 0 }).withMessage('Max occupancy must be a positive integer.');

const addRoomValidation = [
    body('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID is required.'),
    body('roomNumber').trim().notEmpty().withMessage('Room number is required.').isLength({ max: 10 }).withMessage('Room number too long.'),
    roomClassIdValidation,
    maxOccupancyValidation,
    basePriceValidation,
    // Add custom validation for the file if needed (multer handles basic type/size)
    body('roomImage').custom((value, { req }) => {
         // If allowing adding without image initially, make this check conditional or remove
         // if (!req.file) { throw new Error('Room image is required.'); }
         return true;
    })
];

const updateRoomValidation = [
     // Allow optional fields in update
     body('roomClassID').optional().isInt({ gt: 0 }).withMessage('Invalid Room Class ID.'),
     body('basePrice').optional().isFloat({ gt: 0 }).withMessage('Base price must be positive.'),
     body('maxOccupancy').optional().isInt({ gt: 0 }).withMessage('Max occupancy must be positive integer.'),
     // Image is handled separately via multer
];


// --- Routes ---

/**
 * @route   GET /api/rooms/available/:hotelID
 * @desc    Get Available Rooms for a specific Hotel (Consider renaming if it fetches ALL rooms)
 * @access  Public or Private depending on use case
 */
router.get("/available/:hotelID", // Renamed from get-available-rooms
    hotelIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
         // This query assumes 'available_rooms' truly means rooms not currently booked.
         // If it's just ALL rooms, rename the table or adjust the query/route path.
        const sql = `
            SELECT
                ar.RoomID, ar.RoomNumber, ar.BasePrice, ar.MaxOccupancy, ar.RoomImage,
                rc.ClassType, rc.BedType -- Include BedType
            FROM available_rooms ar -- Use aliases for clarity
            JOIN Room_Class rc ON ar.RoomClassID = rc.RoomClassID
            WHERE ar.HotelID = ?
            ORDER BY ar.RoomNumber ASC;
        `;
        try {
            const [rows] = await db.query(sql, [hotelID]);
            // Convert image buffer to base64 for JSON transport
            const rooms = rows.map(room => ({
                ...room,
                RoomImage: room.RoomImage ? Buffer.from(room.RoomImage).toString('base64') : null
            }));
            res.status(200).json({ success: true, data: rooms });
        } catch (err) {
            console.error("Error fetching available rooms:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching rooms." } });
        }
});

/**
 * @route   GET /api/rooms/classes
 * @desc    Get all Room Classes available in the system
 * @access  Public or Private
 */
router.get("/classes", async (req, res) => { // Renamed from get-room-classes
    const sql = "SELECT RoomClassID, ClassType, BedType, Description FROM Room_Class ORDER BY ClassType;";
    try {
        const [results] = await db.query(sql);
        res.status(200).json({ success: true, data: results });
    } catch (err) {
        console.error("Error fetching room classes:", err);
        res.status(500).json({ success: false, error: { message: "Database error fetching room classes." } });
    }
});

/**
 * @route   GET /api/rooms/:roomID
 * @desc    Get details for a single room
 * @access  Private
 */
router.get("/:roomID",
    roomIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { roomID } = req.params;
        const sql = `
             SELECT
                 ar.RoomID, ar.RoomNumber, ar.BasePrice, ar.MaxOccupancy, ar.RoomImage, ar.HotelID,
                 rc.RoomClassID, rc.ClassType, rc.BedType, rc.Description
             FROM available_rooms ar
             JOIN Room_Class rc ON ar.RoomClassID = rc.RoomClassID
             WHERE ar.RoomID = ?;
        `;
        try {
            const [rows] = await db.query(sql, [roomID]);
            if (rows.length === 0) {
                 return res.status(404).json({ success: false, error: { message: "Room not found." } });
            }
            const room = {
                ...rows[0],
                RoomImage: rows[0].RoomImage ? Buffer.from(rows[0].RoomImage).toString('base64') : null
            };
            res.status(200).json({ success: true, data: room });
        } catch (err) {
            console.error("Error fetching room details:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching room details." } });
        }
});


/**
 * @route   POST /api/rooms/add
 * @desc    Add a new room
 * @access  Private (Manager likely required)
 */
router.post('/add',
    upload.single('roomImage'), // Multer middleware for image upload FIRST
    addRoomValidation,         // THEN validation rules
    handleValidationErrors,    // THEN handle errors
    async (req, res) => {
        const { hotelID, roomNumber, roomClassID, maxOccupancy, basePrice } = req.body;
        const roomImageBuffer = req.file ? req.file.buffer : null; // Get buffer from multer

        // Check if room number already exists for this hotel
        const checkQuery = 'SELECT 1 FROM available_rooms WHERE HotelID = ? AND RoomNumber = ?';
        const insertQuery = `
            INSERT INTO available_rooms (HotelID, RoomNumber, RoomClassID, MaxOccupancy, BasePrice, RoomImage)
            VALUES (?, ?, ?, ?, ?, ?);
        `;
        try {
             const [existing] = await db.query(checkQuery, [hotelID, roomNumber]);
             if (existing.length > 0) {
                 return res.status(409).json({ success: false, error: { message: `Room number '${roomNumber}' already exists for this hotel.` } });
             }

            const [result] = await db.query(insertQuery, [hotelID, roomNumber, roomClassID, maxOccupancy, basePrice, roomImageBuffer]);
            res.status(201).json({ success: true, message: 'Room added successfully', data: { roomID: result.insertId } });
        } catch (err) {
            console.error('Add Room Error:', err);
             if (err.code === 'ER_DUP_ENTRY') { // Generic duplicate check
                  return res.status(409).json({ success: false, error: { message: `Room number '${roomNumber}' likely already exists.` } });
             }
            res.status(500).json({ success: false, error: { message: 'Database error adding room.', details: err.message } });
        }
});

/**
 * @route   PUT /api/rooms/:roomID
 * @desc    Update an existing room's details
 * @access  Private (Manager likely required)
 */
router.put("/:roomID",
    upload.single("roomImage"), // Handle potential image upload
    roomIdParamValidation,      // Validate room ID param
    updateRoomValidation,       // Validate optional body fields
    handleValidationErrors,
    async (req, res) => {
        const { roomID } = req.params;
        const { roomClassID, basePrice, maxOccupancy } = req.body; // RoomNumber generally shouldn't be updated easily
        const roomImageBuffer = req.file ? req.file.buffer : undefined; // Use undefined if no new image

        let fieldsToUpdate = [];
        let queryParams = [];

        if (roomClassID !== undefined) { fieldsToUpdate.push("RoomClassID = ?"); queryParams.push(roomClassID); }
        if (basePrice !== undefined) { fieldsToUpdate.push("BasePrice = ?"); queryParams.push(basePrice); }
        if (maxOccupancy !== undefined) { fieldsToUpdate.push("MaxOccupancy = ?"); queryParams.push(maxOccupancy); }
        if (roomImageBuffer !== undefined) { fieldsToUpdate.push("RoomImage = ?"); queryParams.push(roomImageBuffer); }
        // Note: If you want to allow *removing* the image, you'd need a specific flag in the request body
        // and set RoomImage = NULL in the query. Example: if (req.body.removeImage === true) ... RoomImage = NULL

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, error: { message: "No fields provided for update." } });
        }

        const sql = `UPDATE available_rooms SET ${fieldsToUpdate.join(', ')} WHERE RoomID = ?`;
        queryParams.push(roomID);

        try {
            const [result] = await db.query(sql, queryParams);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: { message: "Room not found or no changes detected." } });
            }
            res.status(200).json({ success: true, message: "Room updated successfully." });
        } catch (err) {
            console.error("Error updating room:", err);
            res.status(500).json({ success: false, error: { message: "Database error updating room." } });
        }
});

/**
 * @route   DELETE /api/rooms/:roomID
 * @desc    Delete a room (Use with caution - consider deactivation instead)
 * @access  Private (Admin/Manager likely required)
 */
router.delete("/:roomID",
    roomIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { roomID } = req.params;

        // IMPORTANT: Check if room has current or future bookings before deleting!
        const checkBookingQuery = `SELECT 1 FROM Booking WHERE RoomID = ? AND CheckOutDate >= CURDATE() LIMIT 1`;
        // Alternative: Check if room is currently occupied (might need a different status field)

        // Option 1: Hard Delete (Risky if bookings exist)
        const deleteQuery = `DELETE FROM available_rooms WHERE RoomID = ?`;

        // Option 2: Soft Delete / Deactivate (Safer - requires an 'IsActive' column in available_rooms table)
        // const deactivateQuery = `UPDATE available_rooms SET IsActive = 0 WHERE RoomID = ?`;

        try {
             // Check for active bookings
             const [bookings] = await db.query(checkBookingQuery, [roomID]);
             if (bookings.length > 0) {
                 return res.status(409).json({ success: false, error: { message: "Cannot delete room with current or future bookings. Please cancel bookings first." } });
             }

            // Proceed with deletion (using hard delete query here)
            const [result] = await db.query(deleteQuery, [roomID]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: { message: "Room not found." } });
            }

            res.status(200).json({ success: true, message: "Room deleted successfully." }); // Or "deactivated"
        } catch (err) {
            console.error("Error deleting room:", err);
            // Handle foreign key constraint errors if using hard delete
             if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
                  return res.status(409).json({ success: false, error: { message: "Cannot delete room because it is referenced in other records (e.g., past bookings, maintenance logs)." } });
             }
            res.status(500).json({ success: false, error: { message: "Database error deleting room." } });
        }
});


module.exports = router;