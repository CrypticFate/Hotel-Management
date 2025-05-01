// backend/routes/managerInventoryRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../../dbconn");
const { body, param, validationResult } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

// Reuse helper and validation rules from the enhanced inventoryRoutes.js
// --- Helper Function for Validation Errors ---
const handleValidationErrors = (req, res, next) => { /* ... copy from above ... */ };
// --- Validation Rules ---
const inventoryIdParamValidation = param('inventoryID').isInt({ gt: 0 }).withMessage('Valid Inventory ID parameter is required.');
const addItemValidation = [ /* ... copy from above, but remove hotelID from body validation if taken from req.user ... */
    body('itemName').trim().notEmpty().withMessage('Item Name is required.').isLength({ max: 100 }),
    body('category').trim().optional({ checkFalsy: true }).isLength({ max: 50 }),
    body('unit').trim().optional({ checkFalsy: true }).isLength({ max: 20 }),
    body('lowStockThreshold').optional().isInt({ min: 0 })
];
const orderItemValidation = [ /* ... copy from above, remove hotelID ... */
    body('inventoryID').isInt({ gt: 0 }),
    body('quantity').isFloat({ gt: 0 }),
    body('unitPrice').isFloat({ min: 0 })
];
const receiveOrderValidation = [ /* ... copy from above ... */
    body('transactionID').isInt({ gt: 0 })
];
const adjustInventoryValidation = [ /* ... copy from above, remove hotelID ... */
     body('adjustmentType').isIn(['Stock Count', 'Usage', 'Damage', 'Return', 'Other']),
     body('quantityChange').isFloat(),
     body('reason').optional().trim().isLength({ max: 255 })
];
const updateItemValidation = [ /* ... copy from above ... */
     body('itemName').optional().trim().notEmpty().isLength({ max: 100 }),
     body('category').optional({ nullable: true }).trim().isLength({ max: 50 }),
     body('unit').optional({ nullable: true }).trim().isLength({ max: 20 }),
     body('lowStockThreshold').optional({ nullable: true }).isInt({ min: 0 })
];


// === ROUTES ===
router.use(authenticateToken);
router.use(authorizeRole(['manager'])); // Restrict to managers

/**
 * @route   GET /api/manager/inventory
 * @desc    Fetch Inventory List for the manager's Hotel
 * @access  Private (Manager Only)
 */
router.get("/", async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const query = `
        SELECT InventoryID, ItemName, Category, Quantity, Unit, LowStockThreshold, LastUpdated
        FROM Inventory WHERE HotelID = ? ORDER BY ItemName ASC;
    `;
    try {
        const results = await db.query(query, [managerHotelId]);
        res.status(200).json({ success: true, data: results });
    } catch (err) { /* ... error handling ... */ }
});

/**
 * @route   POST /api/manager/inventory/add-item
 * @desc    Add New Item to manager's hotel Inventory
 * @access  Private (Manager Only)
 */
router.post("/add-item", addItemValidation, handleValidationErrors, async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const { itemName, category, unit, lowStockThreshold } = req.body;
    const query = `INSERT INTO Inventory (HotelID, ItemName, Category, Quantity, Unit, LowStockThreshold, LastUpdated) VALUES (?, ?, ?, 0, ?, ?, NOW());`;
    try {
        // Check duplicate within manager's hotel
        const checkQuery = 'SELECT 1 FROM Inventory WHERE HotelID = ? AND LOWER(ItemName) = LOWER(?)';
        const [existing] = await db.query(checkQuery, [managerHotelId, itemName]);
        if (existing.length > 0) return res.status(409).json({ success: false, error: { message: `Item '${itemName}' already exists in your hotel.` } });

        const result = await db.query(query, [managerHotelId, itemName, category || null, unit || null, lowStockThreshold ?? null]);
        res.status(201).json({ success: true, message: "Item added", data: { inventoryID: result.insertId } });
    } catch (err) { /* ... error handling ... */ }
});

/**
 * @route   PUT /api/manager/inventory/item/:inventoryID
 * @desc    Update item details in manager's hotel
 * @access  Private (Manager Only)
 */
router.put("/item/:inventoryID", inventoryIdParamValidation, updateItemValidation, handleValidationErrors, async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const { inventoryID } = req.params;
    const { itemName, category, unit, lowStockThreshold } = req.body;

    // Build query dynamically
    let fieldsToUpdate = []; let queryParams = [];
    const addField = (f, v) => { if (v !== undefined) { fieldsToUpdate.push(`${f} = ?`); queryParams.push(v === '' ? null : v); } };
    addField('ItemName', itemName); addField('Category', category); addField('Unit', unit); addField('LowStockThreshold', lowStockThreshold);
    if (fieldsToUpdate.length === 0) return res.status(400).json({ success: false, error: { message: "No update fields provided." } });
    fieldsToUpdate.push("LastUpdated = NOW()");

    // Ensure update only happens for manager's hotel
    const query = `UPDATE Inventory SET ${fieldsToUpdate.join(', ')} WHERE InventoryID = ? AND HotelID = ?`;
    queryParams.push(inventoryID, managerHotelId);

    try {
         // Check for duplicate name if changed
         if (itemName !== undefined) {
              const checkQuery = 'SELECT 1 FROM Inventory WHERE LOWER(ItemName) = LOWER(?) AND InventoryID <> ? AND HotelID = ?';
              const [existing] = await db.query(checkQuery, [itemName, inventoryID, managerHotelId]);
              if (existing.length > 0) return res.status(409).json({ success: false, error: { message: `Item name '${itemName}' already exists.` } });
         }

        const [result] = await db.query(query, queryParams);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: { message: "Item not found in your hotel or no changes made." } });
        res.status(200).json({ success: true, message: "Item updated." });
    } catch (err) { /* ... error handling ... */ }
});


/**
 * @route   PATCH /api/manager/inventory/adjust/:inventoryID
 * @desc    Adjust stock quantity for an item in manager's hotel
 * @access  Private (Manager Only)
 */
router.patch("/adjust/:inventoryID", inventoryIdParamValidation, adjustInventoryValidation, handleValidationErrors, async (req, res) => {
     const managerHotelId = req.user.hotelId;
     const { inventoryID } = req.params;
     const { adjustmentType, quantityChange, reason } = req.body;

     const connection = await db.getConnection();
     await connection.beginTransaction();
     try {
          // Verify item belongs to hotel AND lock row
          const [itemCheck] = await connection.query('SELECT Quantity FROM Inventory WHERE InventoryID = ? AND HotelID = ? FOR UPDATE', [inventoryID, managerHotelId]);
          if (itemCheck.length === 0) {
               await connection.rollback();
               return res.status(404).json({ success: false, error: { message: "Item not found in your hotel." } });
          }
          // Optional: Check if adjustment makes quantity negative if disallowed
          // if (itemCheck[0].Quantity + quantityChange < 0) { ... rollback ... }

          // 1. Update Inventory
          const updateQuery = `UPDATE Inventory SET Quantity = Quantity + ?, LastUpdated = NOW() WHERE InventoryID = ?`;
          await connection.query(updateQuery, [quantityChange, inventoryID]);

          // 2. Log Transaction
          const logQuery = `INSERT INTO InventoryTransactions (InventoryID, HotelID, TransactionType, Quantity, Status, Reason, TransactionDate) VALUES (?, ?, ?, ?, 'Completed', ?, NOW());`;
          await connection.query(logQuery, [inventoryID, managerHotelId, adjustmentType, quantityChange, reason || null]);

          await connection.commit();
          res.status(200).json({ success: true, message: "Inventory adjusted." });
     } catch (err) {
          await connection.rollback();
          console.error("Manager error adjusting inventory:", err);
          res.status(500).json({ success: false, error: { message: "Database error adjusting inventory." } });
     } finally {
          connection.release();
     }
});


/**
 * @route   POST /api/manager/inventory/order-item
 * @desc    Place an order for an item in the manager's hotel
 * @access  Private (Manager Only)
 */
router.post("/order-item", orderItemValidation, handleValidationErrors, async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const { inventoryID, quantity, unitPrice } = req.body;
    const checkQuery = 'SELECT 1 FROM Inventory WHERE InventoryID = ? AND HotelID = ?';
    const insertQuery = `INSERT INTO InventoryTransactions (InventoryID, HotelID, TransactionType, Quantity, Status, UnitPrice, TransactionDate) VALUES (?, ?, 'Order', ?, 'Pending', ?, NOW());`;
    try {
        const [itemExists] = await db.query(checkQuery, [inventoryID, managerHotelId]);
        if (itemExists.length === 0) return res.status(404).json({ success: false, error: { message: "Item not found in your hotel." } });

        const result = await db.query(insertQuery, [inventoryID, managerHotelId, quantity, unitPrice]);
        res.status(200).json({ success: true, message: "Order placed.", data: { transactionID: result.insertId } });
    } catch (err) { /* ... error handling ... */ }
});

/**
 * @route   GET /api/manager/inventory/transactions
 * @desc    Fetch Transactions for manager's hotel
 * @access  Private (Manager Only)
 */
router.get("/transactions", async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const query = `
        SELECT T.*, I.ItemName FROM InventoryTransactions T JOIN Inventory I ON T.InventoryID = I.InventoryID
        WHERE T.HotelID = ? ORDER BY T.TransactionDate DESC;
    `;
    try {
        const results = await db.query(query, [managerHotelId]);
        res.status(200).json({ success: true, data: results });
    } catch (err) { /* ... error handling ... */ }
});

/**
 * @route   POST /api/manager/inventory/receive-order
 * @desc    Receive an order for the manager's hotel
 * @access  Private (Manager Only)
 */
router.post("/receive-order", receiveOrderValidation, handleValidationErrors, async (req, res) => {
    const managerHotelId = req.user.hotelId; // Get from authenticated user
    const { transactionID } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
        // 1. Get transaction and lock, ensuring it belongs to the manager's hotel
        const selectQuery = `SELECT InventoryID, Quantity FROM InventoryTransactions WHERE TransactionID = ? AND HotelID = ? AND Status = 'Pending' AND TransactionType = 'Order' FOR UPDATE`;
        const [transactions] = await connection.query(selectQuery, [transactionID, managerHotelId]);
        if (transactions.length === 0) {
             await connection.rollback();
             return res.status(404).json({ success: false, error: { message: "Pending order transaction not found for your hotel or already completed." } });
        }
        const { InventoryID, Quantity } = transactions[0];

        // 2. Update Inventory
        const updateInvQuery = `UPDATE Inventory SET Quantity = Quantity + ?, LastUpdated = NOW() WHERE InventoryID = ? AND HotelID = ?`; // Double check hotelID
        const [updateResult] = await connection.query(updateInvQuery, [Quantity, InventoryID, managerHotelId]);
        if (updateResult.affectedRows === 0) { /* ... consistency error handling ... */ }


        // 3. Update Transaction
        const updateTransQuery = `UPDATE InventoryTransactions SET Status = 'Completed', ReceiveDate = NOW() WHERE TransactionID = ?`;
        await connection.query(updateTransQuery, [transactionID]);

        await connection.commit();
        res.status(200).json({ success: true, message: "Order received and inventory updated." });
    } catch (err) {
         await connection.rollback();
         /* ... error handling ... */
    } finally {
         connection.release();
    }
});

// Transaction Summary Route (similar to enhanced inventoryRoutes.js, just use managerHotelId)
router.get("/transaction-summary", async (req, res) => {
     const managerHotelId = req.user.hotelId;
     // ... rest of the summary query logic from enhanced inventoryRoutes.js using managerHotelId ...
     // ... Make sure date range filtering is added if needed ...
     const now = new Date();
     const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
     const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
     const startDate = firstDayCurrentMonth.toISOString().split('T')[0];
     const endDate = firstDayNextMonth.toISOString().split('T')[0];
     const query = `
         SELECT IFNULL(Status, 'Total') AS Status, TransactionType, COUNT(*) AS TransactionCount,
                COALESCE(SUM(Quantity), 0) AS TotalQuantity, COALESCE(SUM(Quantity * UnitPrice), 0) AS TotalValue
         FROM InventoryTransactions WHERE HotelID = ? AND TransactionDate >= ? AND TransactionDate < ?
         GROUP BY Status, TransactionType WITH ROLLUP;
     `;
     try {
          const results = await db.query(query, [managerHotelId, startDate, endDate]);
          res.status(200).json({ success: true, data: results });
     } catch (err) { /* ... error handling ... */ }
});


module.exports = router;