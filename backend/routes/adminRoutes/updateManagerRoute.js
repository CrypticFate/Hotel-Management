// backend/routes/managerInfoRoutes.js (Renamed file)

const express = require("express");
const router = express.Router();
const db = require("../../dbconn"); // Assuming promise-based
const { param, query: queryParam, validationResult } = require('express-validator');

// --- Helper: Validation Error Handler ---
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error("Validation Errors:", errors.array());
        return res.status(400).json({
            success: false,
            error: {
                message: "Validation failed.",
                details: errors.array().map(err => ({ field: err.param, message: err.msg }))
            }
        });
    }
    next();
};

// --- Validation ---
const hotelIdParamValidation = param('hotelId').optional().isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required if provided.'); // Optional for routes listing all managers?

// --- Routes ---

/**
 * @route   GET /api/managers
 * @desc    Get all active managers (optionally filter by hotel)
 * @query   hotelId (optional) - Filter managers by hotel
 * @query   name, email, phone (optional) - Filter by these fields
 * @access  Private (Admin role likely required)
 */
router.get("/",
    [ // Query param validations
        queryParam('hotelId').optional().isInt({ gt: 0 }).withMessage('Invalid Hotel ID in query.'),
        queryParam('name').optional().trim().isLength({ min: 1 }),
        queryParam('email').optional().trim().isEmail(),
        queryParam('phone').optional().trim().isLength({ min: 7 })
    ],
    handleValidationErrors,
    async (req, res) => {
        const { hotelId, name, email, phone } = req.query;

        let query = `
            SELECT
                e.EmpID,
                e.FirstName,
                e.LastName,
                CONCAT(e.FirstName, ' ', e.LastName) AS FullName,
                e.hourly_pay, -- Assuming managers might have hourly pay? Or Salary? Adjust as needed
                d.DeptName,
                d.HotelID, -- Include HotelID
                h.Name as HotelName, -- Include Hotel Name
                e.Email,
                e.Phone,
                e.HiredDate,
                e.Address,
                e.working_status
            FROM Employee e
            JOIN Department d ON e.DeptID = d.DeptID
            JOIN Hotel h ON d.HotelID = h.HotelID -- Join Hotel to get name
            WHERE e.working_status = 'Working' AND e.Role = 'manager' AND e.FirstName <> 'System'
        `;
        const params = [];

        if (hotelId) {
            query += " AND d.HotelID = ?";
            params.push(hotelId);
        }
        if (name) {
            query += " AND CONCAT(e.FirstName, ' ', e.LastName) LIKE ?";
            params.push(`%${name}%`);
        }
        if (email) {
            query += " AND e.Email LIKE ?";
            params.push(`%${email}%`);
        }
        if (phone) {
            query += " AND e.Phone LIKE ?";
            params.push(`%${phone}%`);
        }

        query += " ORDER BY h.Name, e.LastName, e.FirstName;";

        try {
            const results = await db.query(query, params);
            res.json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching managers:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching managers." } });
        }
});


/**
 * @route   GET /api/managers/lookups/hotels
 * @desc    Get a simple list of all hotels (ID and Name)
 * @access  Private (Used for assigning managers, etc.)
 */
router.get("/lookups/hotels", async (req, res) => {
    // Consider filtering by status = 'active' if needed
    const query = `SELECT HotelID, Name FROM Hotel ORDER BY Name ASC;`;
    try {
        const results = await db.query(query);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error("Error fetching hotel list:", err);
        res.status(500).json({ success: false, error: { message: "Database error fetching hotels." } });
    }
});


// --- Removed Redundant Routes ---
// POST /find-departments -> Use GET /api/employees/departments/:hotelID (or a general GET /api/departments/:hotelID)
// POST /remove-employee -> Use DELETE /api/employees/:empID
// POST /update-manager -> Use PUT /api/employees/update (Authorization middleware should handle permissions)
// POST /filter-managers -> Integrated into GET /api/managers with query parameters

module.exports = router;