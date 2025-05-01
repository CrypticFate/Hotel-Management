// backend/routes/managerFinancialRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../../dbconn");
const { query: queryParam, validationResult } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Reuse helper and date range validation from enhanced financialReportRoutes.js
// --- Helper Function for Validation Errors ---
const handleValidationErrors = (req, res, next) => { /* ... copy from above ... */ };
// --- Validation Rules ---
const dateRangeValidation = [ /* ... copy date range validation from above ... */ ];

// === ROUTES ===
router.use(authenticateToken);
router.use(authorizeRole(['manager'])); // Restrict to managers

/**
 * @route   GET /api/manager/financials/summary
 * @desc    Get overall financial summary for manager's hotel for a date range
 * @query   start, end (required date range)
 * @access  Private (Manager Only)
 */
router.get('/summary', dateRangeValidation, handleValidationErrors, async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const { start, end } = req.query;
    const endDateExclusive = new Date(end); endDateExclusive.setDate(endDateExclusive.getDate() + 1);
    const endParam = endDateExclusive.toISOString().split('T')[0];

    try {
        // Use Promise.all with managerHotelId
        const [
            [[{ totalRevenue }]], [[{ totalInventoryCost }]], [[{ totalMaintenanceCost }]], [[{ totalEstimatedSalary }]]
        ] = await Promise.all([
            // Revenue
            db.query(`SELECT COALESCE(SUM(t.AmountPaid), 0) AS totalRevenue FROM Transactions t JOIN Booking b ON b.BookingID = t.BookingID WHERE b.HotelID = ? AND t.PaymentDate >= ? AND t.PaymentDate < ?`, [managerHotelId, start, endParam]),
            // Inventory Cost
            db.query(`SELECT COALESCE(SUM(Quantity * UnitPrice), 0) AS totalInventoryCost FROM InventoryTransactions WHERE HotelID = ? AND Status = 'Completed' AND TransactionType IN ('Order') AND TransactionDate >= ? AND TransactionDate < ?`, [managerHotelId, start, endParam]), // Simplified cost view
            // Maintenance Cost
            db.query(`SELECT COALESCE(SUM(Amount), 0) AS totalMaintenanceCost FROM BillMaintenanceLedger WHERE HotelID = ? AND LedgerDate >= ? AND LedgerDate < ?`, [managerHotelId, start, endParam]),
            // Estimated Salary (Simplified)
            db.query(`SELECT COALESCE(SUM(e.Salary), 0) AS totalEstimatedSalary FROM Employee e JOIN Department d ON e.DeptID = d.DeptID WHERE d.HotelID = ? AND e.HiredDate < ? AND (e.TerminationDate IS NULL OR e.TerminationDate >= ?)`, [managerHotelId, endParam, start])
        ]);

        const totalExpenses = totalInventoryCost + totalMaintenanceCost + totalEstimatedSalary;
        const netResult = totalRevenue - totalExpenses;

        res.json({
            success: true,
            data: { startDate: start, endDate: end, totalRevenue, totalInventoryCost, totalMaintenanceCost, totalEstimatedSalary, totalEstimatedExpenses: totalExpenses, estimatedNetResult: netResult }
        });
    } catch (err) {
        console.error('Manager Financial Summary Error:', err);
        res.status(500).json({ success: false, error: { message: 'Database error loading financial summary.' } });
    }
});

/**
 * @route   GET /api/manager/financials/revenue-monthly
 * @desc    Get Monthly Revenue for manager's hotel for a specific year
 * @query   year (optional, default current year)
 * @access  Private (Manager Only)
 */
router.get('/revenue-monthly',
    [ queryParam('year').optional().isInt({ min: 2000, max: new Date().getFullYear() + 1 }).toInt() ],
    handleValidationErrors,
    async (req, res) => {
        const managerHotelId = req.user.hotelId;
        const year = req.query.year || new Date().getFullYear();
        const query = `
            SELECT MONTH(T.PaymentDate) AS Month, COALESCE(SUM(T.AmountPaid), 0) AS TotalEarnings
            FROM Transactions T JOIN Booking B ON T.BookingID = B.BookingID
            WHERE B.HotelID = ? AND YEAR(T.PaymentDate) = ?
            GROUP BY MONTH(T.PaymentDate) ORDER BY Month ASC;
        `;
        try {
            const results = await db.query(query, [managerHotelId, year]);
            // Format results (optional but recommended)
            const monthlyData = Array.from({ length: 12 }, (_, i) => ({ Month: i + 1, TotalEarnings: 0 }));
            results.forEach(row => { if (monthlyData[row.Month - 1]) monthlyData[row.Month - 1].TotalEarnings = row.TotalEarnings; });
            res.json({ success: true, data: monthlyData, year: year });
        } catch (err) { /* ... error handling ... */ }
});

// Add other relevant financial routes for managers similarly (e.g., maintenance monthly, inventory cost monthly)

/**
 * @route   POST /api/manager/financials/maintenance-ledger
 * @desc    Add a maintenance expense entry for the manager's hotel
 * @access  Private (Manager Only)
 */
router.post('/maintenance-ledger',
    [ // Validation specific to this route
         body('serviceType').trim().notEmpty().isLength({ max: 100 }),
         body('amount').isFloat({ gt: 0 }),
         body('ledgerDate').isISO8601().toDate()
    ],
    handleValidationErrors,
    async (req, res) => {
        const managerHotelId = req.user.hotelId;
        const { serviceType, amount, ledgerDate } = req.body;
        const query = `INSERT INTO BillMaintenanceLedger (HotelID, ServiceType, Amount, LedgerDate) VALUES (?, ?, ?, ?);`;
        try {
            const result = await db.query(query, [managerHotelId, serviceType, amount, ledgerDate]);
            res.status(201).json({ success: true, message: "Maintenance entry added.", data: { ledgerID: result.insertId } });
        } catch (err) { /* ... error handling ... */ }
});

/**
 * @route   GET /api/manager/financials/maintenance-ledger
 * @desc    Get maintenance ledger entries for manager's hotel (add date filtering)
 * @access  Private (Manager Only)
 */
router.get('/maintenance-ledger',
     [ // Optional date filters
          queryParam('start').optional().isISO8601().toDate(),
          queryParam('end').optional().isISO8601().toDate()
             .custom((end, { req }) => { if (req.query.start && new Date(end) < new Date(req.query.start)) throw new Error('End date must be after start.'); return true; })
     ],
     handleValidationErrors,
     async (req, res) => {
        const managerHotelId = req.user.hotelId;
        const { start, end } = req.query;

        let query = `SELECT LedgerID, ServiceType, Amount, LedgerDate FROM BillMaintenanceLedger WHERE HotelID = ?`;
        const params = [managerHotelId];

        if (start) { query += ` AND LedgerDate >= ?`; params.push(start); }
        if (end) {
             const endDateExclusive = new Date(end); endDateExclusive.setDate(endDateExclusive.getDate() + 1);
             const endParam = endDateExclusive.toISOString().split('T')[0];
             query += ` AND LedgerDate < ?`; params.push(endParam);
        }
        query += ` ORDER BY LedgerDate DESC;`;

        try {
            const results = await db.query(query, params);
            res.status(200).json({ success: true, data: results });
        } catch (err) { /* ... error handling ... */ }
});


module.exports = router;