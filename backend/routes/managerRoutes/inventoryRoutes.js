// backend/routes/inventoryRoutes.js

const express = require("express");
const router = express.Router();
const db = require("../../dbconn"); // Assuming promise-based or wrapped
const { body, param, validationResult } = require('express-validator');

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
const transactionIdParamValidation = param('transactionID').isInt({ gt: 0 }).withMessage('Valid Transaction ID parameter is required.');
const inventoryIdParamValidation = param('inventoryID').isInt({ gt: 0 }).withMessage('Valid Inventory ID parameter is required.');

const addItemValidation = [
    body('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID is required.'),
    body('itemName').trim().notEmpty().withMessage('Item Name is required.').isLength({ max: 100 }).withMessage('Item Name too long.'),
    body('category').trim().optional({ checkFalsy: true }).isLength({ max: 50 }).withMessage('Category name too long.'),
    body('unit').trim().optional({ checkFalsy: true }).isLength({ max: 20 }).withMessage('Unit name too long.'),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer.')
];

const orderItemValidation = [
    body('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID is required.'),
    body('inventoryID').isInt({ gt: 0 }).withMessage('Valid Inventory ID is required.'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Quantity must be a positive number.'),
    body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price cannot be negative.')
];

const receiveOrderValidation = [
    body('transactionID').isInt({ gt: 0 }).withMessage('Valid Transaction ID is required.')
];

const updateItemValidation = [
    body('itemName').trim().optional().isLength({ max: 100 }).withMessage('Item Name too long.'),
    body('category').trim().optional({ nullable: true }).isLength({ max: 50 }).withMessage('Category name too long.'),
    body('unit').trim().optional({ nullable: true }).isLength({ max: 20 }).withMessage('Unit name too long.'),
    body('lowStockThreshold').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Threshold must be a non-negative integer.')
];

// --- Routes ---

/**
 * @route   GET /api/inventory/:hotelID
 * @desc    Fetch Inventory List for a Hotel
 * @access  Private
 */
router.get("/:hotelID",
    hotelIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
        // Include new fields in the query
        const query = `
            SELECT InventoryID, ItemName, Category, Quantity, Unit, LowStockThreshold, LastUpdated
            FROM Inventory
            WHERE HotelID = ?
            ORDER BY ItemName ASC;
        `;
        try {
            const results = await db.query(query, [hotelID]);
            res.status(200).json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching inventory:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching inventory." } });
        }
});

/**
 * @route   GET /api/inventory/item/:inventoryID
 * @desc    Fetch details for a single inventory item
 * @access  Private
 */
router.get("/item/:inventoryID",
    inventoryIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { inventoryID } = req.params;
        const query = `
            SELECT InventoryID, HotelID, ItemName, Category, Quantity, Unit, LowStockThreshold, LastUpdated
            FROM Inventory
            WHERE InventoryID = ?;
        `;
        try {
            const [results] = await db.query(query, [inventoryID]);
            if (!results || results.length === 0) {
                return res.status(404).json({ success: false, error: { message: "Inventory item not found." } });
            }
            res.status(200).json({ success: true, data: results[0] });
        } catch (err) {
            console.error("Error fetching inventory item:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching inventory item." } });
        }
});


/**
 * @route   POST /api/inventory/add-item
 * @desc    Add New Item to Inventory
 * @access  Private (Manager likely required)
 */
router.post("/add-item",
    addItemValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelID, itemName, category, unit, lowStockThreshold } = req.body;
        // Default quantity is 0, threshold defaults in DB or use value provided
        const query = `
            INSERT INTO Inventory (HotelID, ItemName, Category, Quantity, Unit, LowStockThreshold, LastUpdated)
            VALUES (?, ?, ?, 0, ?, ?, NOW());
        `;
        try {
            // Check if item name already exists for this hotel
            const checkQuery = 'SELECT 1 FROM Inventory WHERE HotelID = ? AND LOWER(ItemName) = LOWER(?)';
            const [existing] = await db.query(checkQuery, [hotelID, itemName]);
            if (existing.length > 0) {
                 return res.status(409).json({ success: false, error: { message: `Item '${itemName}' already exists for this hotel.` } });
            }

            const result = await db.query(query, [hotelID, itemName, category || null, unit || null, lowStockThreshold ?? null]); // Use DB default for threshold if not provided
            res.status(201).json({ success: true, message: "Item added successfully", data: { inventoryID: result.insertId } });
        } catch (err) {
            console.error("Error adding item:", err);
             if (err.code === 'ER_DUP_ENTRY') { // More specific check if you have constraints
                 return res.status(409).json({ success: false, error: { message: `Item '${itemName}' already exists.` } });
             }
            res.status(500).json({ success: false, error: { message: "Database error adding item." } });
        }
});

/**
 * @route   PUT /api/inventory/item/:inventoryID
 * @desc    Update an existing inventory item's details (name, category, etc., NOT quantity)
 * @access  Private (Manager likely required)
 */
router.put("/item/:inventoryID",
    inventoryIdParamValidation,
    updateItemValidation, // Validation rules for update payload
    handleValidationErrors,
    async (req, res) => {
        const { inventoryID } = req.params;
        const { itemName, category, unit, lowStockThreshold } = req.body;

        // Build query dynamically based on provided fields
        let fieldsToUpdate = [];
        let queryParams = [];

        if (itemName !== undefined) { fieldsToUpdate.push("ItemName = ?"); queryParams.push(itemName); }
        if (category !== undefined) { fieldsToUpdate.push("Category = ?"); queryParams.push(category || null); } // Allow setting to null
        if (unit !== undefined) { fieldsToUpdate.push("Unit = ?"); queryParams.push(unit || null); }
        if (lowStockThreshold !== undefined) { fieldsToUpdate.push("LowStockThreshold = ?"); queryParams.push(lowStockThreshold ?? null); } // Allow setting to null (use DB default)

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, error: { message: "No fields provided for update." } });
        }

        // Always update LastUpdated timestamp
        fieldsToUpdate.push("LastUpdated = NOW()");

        const query = `UPDATE Inventory SET ${fieldsToUpdate.join(', ')} WHERE InventoryID = ?`;
        queryParams.push(inventoryID);

        try {
             // Optional: Check for duplicate item name if itemName is being changed
             if (itemName !== undefined) {
                 const checkQuery = 'SELECT 1 FROM Inventory WHERE LOWER(ItemName) = LOWER(?) AND InventoryID <> ? AND HotelID = (SELECT HotelID FROM Inventory WHERE InventoryID = ?)';
                 const [existing] = await db.query(checkQuery, [itemName, inventoryID, inventoryID]);
                 if (existing.length > 0) {
                      return res.status(409).json({ success: false, error: { message: `Another item with name '${itemName}' already exists.` } });
                 }
             }

            const [result] = await db.query(query, queryParams);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: { message: "Inventory item not found." } });
            }
            res.status(200).json({ success: true, message: "Item details updated successfully." });
        } catch (err) {
            console.error("Error updating item:", err);
             if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(409).json({ success: false, error: { message: `Update failed: Item name '${itemName}' may already exist.` } });
             }
            res.status(500).json({ success: false, error: { message: "Database error updating item." } });
        }
});

/**
 * @route   PATCH /api/inventory/adjust/:inventoryID
 * @desc    Adjust the quantity of an inventory item (e.g., stock count, usage)
 * @access  Private
 */
router.patch("/adjust/:inventoryID",
    inventoryIdParamValidation,
    [ // Specific validation for adjustment
        body('adjustmentType').isIn(['Stock Count', 'Usage', 'Damage', 'Return', 'Other']).withMessage('Invalid adjustment type.'),
        body('quantityChange').isFloat().withMessage('Quantity change must be a number (can be negative for usage/damage).'),
        body('reason').optional().trim().isLength({ max: 255 }).withMessage('Reason is too long.'),
        body('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID is required.') // Needed for transaction log
    ],
    handleValidationErrors,
    async (req, res) => {
        const { inventoryID } = req.params;
        const { adjustmentType, quantityChange, reason, hotelID } = req.body;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Update Inventory Quantity (ensure quantity doesn't go below zero if needed)
            // Consider adding a check: `Quantity + ? >= 0` in the WHERE clause if negative stock is disallowed
            const updateQuery = `UPDATE Inventory SET Quantity = Quantity + ?, LastUpdated = NOW() WHERE InventoryID = ?`;
            const [updateResult] = await connection.query(updateQuery, [quantityChange, inventoryID]);

            if (updateResult.affectedRows === 0) {
                 await connection.rollback();
                return res.status(404).json({ success: false, error: { message: "Inventory item not found." } });
            }

             // Check if stock went negative if that's disallowed (requires fetching current quantity first or modifying query)
             // const [currentStock] = await connection.query('SELECT Quantity FROM Inventory WHERE InventoryID = ?', [inventoryID]);
             // if (currentStock[0].Quantity < 0) { // Error if negative stock not allowed
             //      await connection.rollback();
             //      return res.status(400).json({ success: false, error: { message: "Adjustment results in negative stock, which is not allowed." } });
             // }

            // 2. Log the Adjustment Transaction
            const logQuery = `
                INSERT INTO InventoryTransactions (InventoryID, HotelID, TransactionType, Quantity, Status, Reason, TransactionDate)
                VALUES (?, ?, ?, ?, 'Completed', ?, NOW());
            `;
            await connection.query(logQuery, [inventoryID, hotelID, adjustmentType, quantityChange, reason || null]);

            await connection.commit();
            res.status(200).json({ success: true, message: "Inventory quantity adjusted successfully." });

        } catch (err) {
            await connection.rollback();
            console.error("Error adjusting inventory:", err);
            res.status(500).json({ success: false, error: { message: "Database error adjusting inventory." } });
        } finally {
            connection.release();
        }
});


/**
 * @route   POST /api/inventory/order-item
 * @desc    Place a new Order Transaction (Status: Pending)
 * @access  Private
 */
router.post("/order-item",
    orderItemValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelID, inventoryID, quantity, unitPrice } = req.body;

        // Check if inventory item exists for the hotel first
        const checkQuery = 'SELECT 1 FROM Inventory WHERE InventoryID = ? AND HotelID = ?';
        const insertTransactionQuery = `
            INSERT INTO InventoryTransactions (InventoryID, HotelID, TransactionType, Quantity, Status, UnitPrice, TransactionDate)
            VALUES (?, ?, 'Order', ?, 'Pending', ?, NOW());
        `;
        try {
             const [itemExists] = await db.query(checkQuery, [inventoryID, hotelID]);
             if (itemExists.length === 0) {
                 return res.status(404).json({ success: false, error: { message: "Inventory item not found for this hotel." } });
             }

            const result = await db.query(insertTransactionQuery, [inventoryID, hotelID, quantity, unitPrice]);
            res.status(200).json({ success: true, message: "Order placed successfully", data: { transactionID: result.insertId } });
        } catch (err) {
            console.error("Error placing order:", err);
            res.status(500).json({ success: false, error: { message: "Database error placing order." } });
        }
});

/**
 * @route   GET /api/inventory/transactions/:hotelID
 * @desc    Fetch Transactions for Specific Hotel
 * @access  Private
 */
router.get("/transactions/:hotelID",
    hotelIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
        // Join with Inventory to get ItemName
        const query = `
            SELECT T.TransactionID, T.InventoryID, I.ItemName, T.HotelID, T.TransactionType,
                   T.Quantity, T.UnitPrice, T.Status, T.TransactionDate, T.ReceiveDate, T.Reason
            FROM InventoryTransactions T
            JOIN Inventory I ON T.InventoryID = I.InventoryID
            WHERE T.HotelID = ?
            ORDER BY T.TransactionDate DESC;
        `;
        try {
            const results = await db.query(query, [hotelID]);
            res.status(200).json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching transactions:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching transactions." } });
        }
});

/**
 * @route   POST /api/inventory/receive-order
 * @desc    Mark an order as received and update inventory quantity
 * @access  Private
 */
router.post("/receive-order",
    receiveOrderValidation,
    handleValidationErrors,
    async (req, res) => {
        const { transactionID } = req.body;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Get transaction details (only pending orders) and lock the row
            const selectQuery = `SELECT InventoryID, Quantity, HotelID FROM InventoryTransactions WHERE TransactionID = ? AND Status = 'Pending' AND TransactionType = 'Order' FOR UPDATE`;
            const [transactions] = await connection.query(selectQuery, [transactionID]);

            if (transactions.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, error: { message: "Pending order transaction not found or already completed." } });
            }
            const { InventoryID, Quantity } = transactions[0];

            // 2. Update Inventory quantity
            const updateInvQuery = `UPDATE Inventory SET Quantity = Quantity + ?, LastUpdated = NOW() WHERE InventoryID = ?`;
            const [updateResult] = await connection.query(updateInvQuery, [Quantity, InventoryID]);

             if (updateResult.affectedRows === 0) { // Should not happen if transaction exists, but good check
                  await connection.rollback();
                  console.error(`Consistency error: Inventory item ID ${InventoryID} not found during receive order for Tx ID ${transactionID}`);
                  return res.status(404).json({ success: false, error: { message: "Associated inventory item not found." } });
             }

            // 3. Update Transaction status and receive date
            const updateTransQuery = `UPDATE InventoryTransactions SET Status = 'Completed', ReceiveDate = NOW() WHERE TransactionID = ?`;
            await connection.query(updateTransQuery, [transactionID]);

            await connection.commit();
            res.status(200).json({ success: true, message: "Order received and inventory updated successfully." });

        } catch (err) {
            await connection.rollback();
            console.error("Error receiving order:", err);
            res.status(500).json({ success: false, error: { message: "Database error receiving order." } });
        } finally {
            connection.release();
        }
});


/**
 * @route   GET /api/inventory/transaction-summary/:hotelID
 * @desc    Fetch Monthly Transaction Summary (ROLLUP) for current month
 * @access  Private
 */
router.get("/transaction-summary/:hotelID",
    hotelIdParamValidation,
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;

        // Calculate start and end dates for the *current* month
        const now = new Date();
        const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const startDate = firstDayCurrentMonth.toISOString().split('T')[0];
        const endDate = firstDayNextMonth.toISOString().split('T')[0]; // Use < endDate for comparison

        // Query grouping by Status with ROLLUP for totals
        const query = `
            SELECT
                IFNULL(Status, 'Total') AS Status, -- Label the NULL row from ROLLUP
                TransactionType,                 -- Include TransactionType
                COUNT(*) AS TransactionCount,
                COALESCE(SUM(Quantity), 0) AS TotalQuantity,
                COALESCE(SUM(Quantity * UnitPrice), 0) AS TotalValue
            FROM InventoryTransactions
            WHERE HotelID = ?
              AND TransactionDate >= ?
              AND TransactionDate < ?
            GROUP BY Status, TransactionType WITH ROLLUP;
             -- Rollup by Type first, then Status might be more useful depending on need
             -- GROUP BY TransactionType, Status WITH ROLLUP;
        `;
        try {
            const results = await db.query(query, [hotelID, startDate, endDate]);
            res.status(200).json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching transaction summary:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching transaction summary." } });
        }
});


module.exports = router;