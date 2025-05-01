// backend/routes/financialReportRoutes.js (Renamed file)

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

// --- Validation Rules ---
const hotelIdParamValidation = param('hotelId').isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required.');
const dateRangeValidation = [
    queryParam('start').isISO8601().toDate().withMessage('Valid start date (YYYY-MM-DD) is required.'),
    queryParam('end').isISO8601().toDate().withMessage('Valid end date (YYYY-MM-DD) is required.')
        .custom((end, { req }) => {
            if (new Date(end) < new Date(req.query.start)) {
                throw new Error('End date must be after start date.');
            }
            return true;
        })
];

// --- Routes ---

/**
 * @route   GET /api/reports/inventory/:hotelId
 * @desc    Get Inventory Cost Summary by Month within a date range
 * @access  Private
 */
router.get('/inventory/:hotelId',
    hotelIdParamValidation,
    dateRangeValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { start, end } = req.query; // Validated dates

        // Adjust end date to be exclusive for BETWEEN clause (e.g., include whole end day)
        const endDateExclusive = new Date(end);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        const endParam = endDateExclusive.toISOString().split('T')[0];


        const query = `
            SELECT
                DATE_FORMAT(TransactionDate, '%Y-%m') AS Month,
                COALESCE(SUM(Quantity * UnitPrice), 0) AS TotalCost
            FROM InventoryTransactions
            WHERE HotelID = ?
              -- Include orders and potentially other cost-related transactions
              AND TransactionType IN ('Order', 'Adjustment-Damage', 'Adjustment-Usage') -- Adjust types as needed
              AND Status = 'Completed' -- Usually only count completed orders/adjustments
              AND TransactionDate >= ? AND TransactionDate < ? -- Use >= start and < end+1 day
            GROUP BY Month
            ORDER BY Month ASC;
        `;
        try {
            const results = await db.query(query, [hotelId, start, endParam]);
            res.json({ success: true, data: results });
        } catch (err) {
            console.error('Inventory Summary Error:', err);
            res.status(500).json({ success: false, error: { message: 'Database error fetching inventory summary.' } });
        }
});

/**
 * @route   GET /api/reports/maintenance/:hotelId
 * @desc    Get Maintenance Cost Summary by Month within a date range
 * @access  Private
 */
router.get('/maintenance/:hotelId',
    hotelIdParamValidation,
    dateRangeValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { start, end } = req.query;

        const endDateExclusive = new Date(end);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        const endParam = endDateExclusive.toISOString().split('T')[0];

        const query = `
            SELECT
                DATE_FORMAT(LedgerDate, '%Y-%m') AS Month,
                COALESCE(SUM(Amount), 0) AS TotalCost
            FROM BillMaintenanceLedger
            WHERE HotelID = ? AND LedgerDate >= ? AND LedgerDate < ?
            GROUP BY Month
            ORDER BY Month ASC;
        `;
        try {
            const results = await db.query(query, [hotelId, start, endParam]);
            res.json({ success: true, data: results });
        } catch (err) {
            console.error('Maintenance Summary Error:', err);
            res.status(500).json({ success: false, error: { message: 'Database error fetching maintenance summary.' } });
        }
});

/**
 * @route   GET /api/reports/salaries/:hotelId
 * @desc    Get *Estimated* Salary Cost by Department for a given period (complex calculation)
 * @query   start, end (required date range)
 * @access  Private
 */
router.get('/salaries/:hotelId',
    hotelIdParamValidation,
    dateRangeValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { start, end } = req.query;

        // NOTE: Calculating exact salary cost for a date range based on hire/termination
        // and potentially changing hourly rates/salaries is complex SQL.
        // This is a simplified estimation assuming stable salaries/pay within the period.
        // For accuracy, you'd need payroll records or more complex date range logic in SQL.

        // Simplified Approach: Sum monthly/annual salaries of employees active *during* the period.
        // This doesn't account for partial months worked accurately.
        const query = `
            SELECT
                d.DeptName,
                -- Rough estimation: (Annual Salary / 12 * MonthsActive) OR (Hourly * AvgHours * WeeksActive)
                -- Let's just sum the listed Salary (assuming it's monthly or annual - clarify!)
                COALESCE(SUM(e.Salary), 0) AS TotalDeptSalary -- ASSUMING Salary column represents relevant period cost
            FROM Employee e
            JOIN Department d ON e.DeptID = d.DeptID
            WHERE d.HotelID = ?
              AND e.working_status = 'Working' -- Or include inactive if needed?
              -- Filter employees active at any point within the range (basic overlap check)
              AND e.HiredDate < ? -- Hired before the end date
              AND (e.TerminationDate IS NULL OR e.TerminationDate >= ?) -- Not terminated before the start date
            GROUP BY d.DeptName
            ORDER BY d.DeptName;
        `;
        const endDateExclusive = new Date(end);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        const endParam = endDateExclusive.toISOString().split('T')[0];

        try {
            const results = await db.query(query, [hotelId, endParam, start]);
            res.json({ success: true, data: results, note: "Salary cost is an estimation for active employees within the period." });
        } catch (err) {
            console.error('Salary Summary Error:', err);
            res.status(500).json({ success: false, error: { message: 'Database error fetching salary summary.' } });
        }
});

/**
 * @route   GET /api/reports/revenue/:hotelId
 * @desc    Get Monthly Revenue from Transactions within a date range
 * @access  Private
 */
router.get('/revenue/:hotelId',
    hotelIdParamValidation,
    dateRangeValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { start, end } = req.query;

        const endDateExclusive = new Date(end);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        const endParam = endDateExclusive.toISOString().split('T')[0];

        const query = `
            SELECT
                DATE_FORMAT(t.PaymentDate, '%Y-%m') AS Month,
                COALESCE(SUM(t.AmountPaid), 0) AS TotalRevenue
            FROM Transactions t
            JOIN Booking b ON b.BookingID = t.BookingID
            WHERE b.HotelID = ? AND t.PaymentDate >= ? AND t.PaymentDate < ?
            GROUP BY Month
            ORDER BY Month ASC;
        `;
        try {
            const results = await db.query(query, [hotelId, start, endParam]);
            res.json({ success: true, data: results });
        } catch (err) {
            console.error('Transaction Revenue Error:', err);
            res.status(500).json({ success: false, error: { message: 'Database error fetching transaction revenue.' } });
        }
});

/**
 * @route   GET /api/reports/financial-summary/:hotelId
 * @desc    Get overall financial summary (Revenue, Estimated Costs) for a date range
 * @access  Private
 */
router.get('/financial-summary/:hotelId',
    hotelIdParamValidation,
    dateRangeValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelId } = req.params;
        const { start, end } = req.query;

        const endDateExclusive = new Date(end);
        endDateExclusive.setDate(endDateExclusive.getDate() + 1);
        const endParam = endDateExclusive.toISOString().split('T')[0];

        // Use Promise.all to run queries concurrently
        try {
            const [
                [[{ totalRevenue }]],        // Revenue
                [[{ totalInventoryCost }]],   // Inventory Costs (Completed Orders etc.)
                [[{ totalMaintenanceCost }]], // Maintenance Costs
                [[{ totalEstimatedSalary }]]  // Estimated Salary Costs (using simplified logic)
            ] = await Promise.all([
                // Revenue Query
                db.query(
                    `SELECT COALESCE(SUM(t.AmountPaid), 0) AS totalRevenue
                     FROM Transactions t JOIN Booking b ON b.BookingID = t.BookingID
                     WHERE b.HotelID = ? AND t.PaymentDate >= ? AND t.PaymentDate < ?`,
                    [hotelId, start, endParam]
                ),
                // Inventory Cost Query
                db.query(
                    `SELECT COALESCE(SUM(Quantity * UnitPrice), 0) AS totalInventoryCost
                     FROM InventoryTransactions
                     WHERE HotelID = ? AND Status = 'Completed' AND TransactionType IN ('Order', 'Adjustment-Damage', 'Adjustment-Usage')
                       AND TransactionDate >= ? AND TransactionDate < ?`,
                    [hotelId, start, endParam]
                ),
                // Maintenance Cost Query
                db.query(
                    `SELECT COALESCE(SUM(Amount), 0) AS totalMaintenanceCost
                     FROM BillMaintenanceLedger
                     WHERE HotelID = ? AND LedgerDate >= ? AND LedgerDate < ?`,
                    [hotelId, start, endParam]
                ),
                // Estimated Salary Query (Simplified - see note in /salaries route)
                 db.query(
                     `SELECT COALESCE(SUM(e.Salary), 0) AS totalEstimatedSalary -- ASSUMING Salary column is relevant period cost
                      FROM Employee e JOIN Department d ON e.DeptID = d.DeptID
                      WHERE d.HotelID = ? AND e.HiredDate < ? AND (e.TerminationDate IS NULL OR e.TerminationDate >= ?)`,
                    [hotelId, endParam, start]
                 )
            ]);

            const totalExpenses = totalInventoryCost + totalMaintenanceCost + totalEstimatedSalary;
            const netResult = totalRevenue - totalExpenses;

            res.json({
                success: true,
                data: {
                    startDate: start,
                    endDate: end,
                    totalRevenue: totalRevenue,
                    totalInventoryCost: totalInventoryCost,
                    totalMaintenanceCost: totalMaintenanceCost,
                    totalEstimatedSalary: totalEstimatedSalary,
                    totalEstimatedExpenses: totalExpenses,
                    estimatedNetResult: netResult
                }
            });
        } catch (err) {
            console.error('Financial Summary Error:', err);
            res.status(500).json({ success: false, error: { message: 'Database error loading financial summary.' } });
        }
});


module.exports = router;