// backend/routes/ManExpensesRoute.js

const express = require("express");
const router = express.Router();
const db = require("../../dbconn"); // Assuming promise-based or wrapped
const { body, param, query: queryParam, validationResult } = require('express-validator');

// --- Helper Function for Validation Errors ---
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

// --- Validation Rules ---
const hotelIdParamValidation = param('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required.');
const hotelIdQueryValidation = queryParam('hotelId').isInt({ gt: 0 }).withMessage('Valid Hotel ID query parameter is required.');

const addMaintenanceValidation = [
    body('hotelId').isInt({ gt: 0 }).withMessage('Valid Hotel ID is required.'),
    body('serviceType').trim().notEmpty().withMessage('Service type is required.').isLength({ max: 100 }).withMessage('Service type too long.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('ledgerDate').isISO8601().toDate().withMessage('Valid ledger date is required.')
];

// --- Routes ---

/**
 * @route   GET /api/expenses/summary/:hotelID
 * @desc    Fetch total salary cost and earnings for a hotel (for a specified period, default current year)
 * @access  Private (Manager role likely required)
 */
router.get("/summary/:hotelID",
    hotelIdParamValidation,
    [ // Add validation for optional year query parameter
        queryParam('year').optional().isInt({ min: 2000, max: new Date().getFullYear() + 1 }).withMessage('Invalid year specified.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
        const year = req.query.year || new Date().getFullYear(); // Default to current year

        // Query to get total *employee* costs (salary/hourly) and total *booking* revenue for the year
        // NOTE: This assumes Employee table has EITHER Salary OR hourly_pay. Adjust calculation if needed.
        // NOTE: This joins through Department for HotelID association. Ensure this is correct.
        const expenseQuery = `
            SELECT
                COALESCE(SUM(CASE WHEN E.Salary IS NOT NULL THEN E.Salary * 12 ELSE E.hourly_pay * 40 * 52 END), 0) AS TotalEstimatedEmployeeCost -- Example annual cost calc
            FROM Employee E
            JOIN Department D ON E.DeptID = D.DeptID
            WHERE D.HotelID = ? AND YEAR(E.HiredDate) <= ? -- Include employees hired during or before the year
              AND (E.TerminationDate IS NULL OR YEAR(E.TerminationDate) >= ?); -- Exclude employees terminated before the year
        `;

        const revenueQuery = `
            SELECT
                COALESCE(SUM(T.AmountPaid), 0) AS TotalRevenue
            FROM Transactions T
            JOIN Booking B ON T.BookingID = B.BookingID
            WHERE B.HotelID = ? AND YEAR(T.PaymentDate) = ?;
        `;

        // Fetching maintenance costs separately might be cleaner
        const maintenanceQuery = `
            SELECT COALESCE(SUM(Amount), 0) AS TotalMaintenanceCost
            FROM BillMaintenanceLedger
            WHERE HotelID = ? AND YEAR(LedgerDate) = ?;
        `;

        try {
             // Run queries concurrently
             const [
                  [expenseResult], // Destructure to get the first row directly
                  [revenueResult],
                  [maintenanceResult]
             ] = await Promise.all([
                  db.query(expenseQuery, [hotelID, year, year]),
                  db.query(revenueQuery, [hotelID, year]),
                  db.query(maintenanceQuery, [hotelID, year])
             ]);


            res.json({
                success: true,
                data: {
                     year: year,
                     totalEstimatedEmployeeCost: expenseResult?.TotalEstimatedEmployeeCost ?? 0, // Use nullish coalescing
                     totalRevenue: revenueResult?.TotalRevenue ?? 0,
                     totalMaintenanceCost: maintenanceResult?.TotalMaintenanceCost ?? 0,
                     // Calculate estimated profit/loss
                     estimatedProfitLoss: (revenueResult?.TotalRevenue ?? 0) - (expenseResult?.TotalEstimatedEmployeeCost ?? 0) - (maintenanceResult?.TotalMaintenanceCost ?? 0)
                }
            });
        } catch (err) {
            console.error("Error fetching expense/revenue summary:", err);
            res.status(500).json({ success: false, error: { message: "Error fetching financial summary data." } });
        }
});

/**
 * @route   GET /api/expenses/revenue-yearly/:hotelID
 * @desc    Fetch yearly transaction revenue for the last N years
 * @access  Private
 */
router.get("/revenue-yearly/:hotelID",
    hotelIdParamValidation,
    [ queryParam('years').optional().isInt({ min: 1, max: 20 }).withMessage('Invalid number of years (1-20).').toInt() ], // Validate optional years param
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
        const numberOfYears = req.query.years || 5; // Default to 5 years

        const query = `
            SELECT YEAR(T.PaymentDate) AS Year, COALESCE(SUM(T.AmountPaid), 0) AS TotalAmount
            FROM Transactions T
            JOIN Booking B ON T.BookingID = B.BookingID
            WHERE B.HotelID = ?
                -- Fetch data starting from Jan 1st of the year N years ago
                AND T.PaymentDate >= MAKEDATE(YEAR(CURDATE()) - ?, 1)
                -- AND T.PaymentDate >= DATE_SUB(CURDATE(), INTERVAL ? YEAR) -- Alternative, less precise for year start
            GROUP BY YEAR(T.PaymentDate)
            ORDER BY Year ASC;
        `;
        try {
            const results = await db.query(query, [hotelID, numberOfYears -1]); // -1 because interval includes current year
            res.json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching yearly transaction earnings:", err);
            res.status(500).json({ success: false, error: { message: "Error fetching yearly transaction earnings." } });
        }
});

/**
 * @route   GET /api/expenses/revenue-monthly/:hotelID
 * @desc    Get Monthly Transactions Revenue for a specific year (default current)
 * @access  Private
 */
router.get("/revenue-monthly/:hotelID",
    hotelIdParamValidation,
    [ queryParam('year').optional().isInt({ min: 2000, max: new Date().getFullYear() + 1 }).withMessage('Invalid year specified.').toInt() ],
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
        const year = req.query.year || new Date().getFullYear();

        const query = `
            SELECT
                MONTH(T.PaymentDate) AS Month,
                COALESCE(SUM(T.AmountPaid), 0) AS TotalEarnings
            FROM Transactions T
            JOIN Booking B ON T.BookingID = B.BookingID
            WHERE B.HotelID = ? AND YEAR(T.PaymentDate) = ?
            GROUP BY MONTH(T.PaymentDate)
            ORDER BY Month ASC;
        `;
        try {
            const results = await db.query(query, [hotelID, year]);
            // Format results to ensure all 12 months are present (optional but good for charts)
            const monthlyData = Array.from({ length: 12 }, (_, i) => ({ Month: i + 1, TotalEarnings: 0 }));
            results.forEach(row => {
                const monthIndex = row.Month - 1;
                if (monthlyData[monthIndex]) {
                     monthlyData[monthIndex].TotalEarnings = row.TotalEarnings;
                }
            });
            res.json({ success: true, data: monthlyData, year: year });
        } catch (err) {
            console.error("Error fetching monthly transactions:", err);
            res.status(500).json({ success: false, error: { message: "Error fetching monthly transactions." } });
        }
});

// --- Maintenance Ledger Routes --- (Consider moving to /api/maintenance ?)

/**
 * @route   POST /api/expenses/maintenance-ledger
 * @desc    Add a new maintenance ledger entry
 * @access  Private
 */
router.post('/maintenance-ledger',
    addMaintenanceValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId, serviceType, amount, ledgerDate } = req.body;
        const query = `
            INSERT INTO BillMaintenanceLedger (HotelID, ServiceType, Amount, LedgerDate)
            VALUES (?, ?, ?, ?);
        `;
        try {
            const result = await db.query(query, [hotelId, serviceType, amount, ledgerDate]);
            res.status(201).json({ success: true, message: "Maintenance entry added successfully", data: { ledgerID: result.insertId } });
        } catch (err) {
            console.error("Error adding maintenance ledger:", err);
            res.status(500).json({ success: false, error: { message: "Database error adding maintenance ledger." } });
        }
});

/**
 * @route   GET /api/expenses/maintenance-ledger
 * @desc    Fetch all maintenance ledger entries for a hotel (add filtering/pagination later)
 * @access  Private
 */
router.get('/maintenance-ledger',
    hotelIdQueryValidation, // Use query param validation
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.query; // Get from query
        // Add filtering by date range, service type? Add pagination?
        const query = `SELECT LedgerID, HotelID, ServiceType, Amount, LedgerDate FROM BillMaintenanceLedger WHERE HotelID = ? ORDER BY LedgerDate DESC;`;
        try {
            const results = await db.query(query, [hotelId]);
            res.status(200).json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching maintenance ledger:", err);
            res.status(500).json({ success: false, error: { message: "Error fetching maintenance ledger." } });
        }
});

module.exports = router;