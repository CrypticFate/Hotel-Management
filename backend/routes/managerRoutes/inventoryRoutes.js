const express = require("express");
const router = express.Router();
const db = require("../../dbconn");

/* ✅ Fetch Inventory List based on HotelID */
router.get("/inventory/:hotelID", (req, res) => {
    const hotelID = req.params.hotelID;

    if (!hotelID) {
        return res.status(400).send("Hotel ID is required");
    }

    const query = `
    SELECT InventoryID, ItemName, Quantity, LastUpdated
    FROM Inventory
    WHERE HotelID = ?
  `;

    db.query(query, [hotelID], (err, results) => {
        if (err) {
            console.error("Error fetching inventory:", err);
            return res.status(500).send("Error fetching inventory");
        }
        res.status(200).json(results);
    });
});

/* ✅ Add New Item */
router.post("/add-item", (req, res) => {
    const { hotelID, itemName } = req.body;

    if (!hotelID || !itemName) {
        return res.status(400).send("Hotel ID and Item Name are required");
    }

    const query = `
    INSERT INTO Inventory (HotelID, ItemName, Quantity)
    VALUES (?, ?, 0)
  `;

    db.query(query, [hotelID, itemName], (err, result) => {
        if (err) {
            console.error("Error adding item:", err);
            return res.status(500).send("Error adding item");
        }
        res.status(201).json({ message: "Item added successfully", InventoryID: result.insertId });
    });
});

/* ✅ Place an Order */
router.post("/order-item", (req, res) => {
    const { hotelID, inventoryID, quantity, unitPrice } = req.body;

    if (!hotelID || !inventoryID || !quantity || quantity <= 0 || unitPrice == null) {
        return res.status(400).send("Hotel ID, Inventory ID, valid quantity, and unit price are required");
    }

    const insertTransactionQuery = `
    INSERT INTO InventoryTransactions (InventoryID, HotelID, TransactionType, Quantity, Status, UnitPrice)
    VALUES (?, ?, 'Order', ?, 'Pending', ?)
  `;

    db.query(insertTransactionQuery, [inventoryID, hotelID, quantity, unitPrice], (err, result) => {
        if (err) {
            console.error("Error placing order:", err);
            return res.status(500).send("Error placing order");
        }
        res.status(200).json({ message: "Order placed successfully" });
    });
});

/* ✅ Fetch Transactions for Specific Hotel */
router.get("/transactions/:hotelID", (req, res) => {
    const hotelID = req.params.hotelID;

    if (!hotelID) {
        return res.status(400).send("Hotel ID is required");
    }

    const query = `
    SELECT TransactionID, InventoryID, HotelID, TransactionType, Quantity, UnitPrice, Status, TransactionDate, ReceiveDate
    FROM InventoryTransactions
    WHERE HotelID = ?
  `;

    db.query(query, [hotelID], (err, results) => {
        if (err) {
            console.error("Error fetching transactions:", err);
            return res.status(500).send("Error fetching transactions");
        }
        res.status(200).json(results);
    });
});





module.exports = router;
