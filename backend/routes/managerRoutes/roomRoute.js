const express = require("express");
const router = express.Router();
const db = require("../../dbconn");
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });


// ✅ Get Available Rooms
router.get("/get-available-rooms/:hotelID", async (req, res) => {
    const hotelID = req.params.hotelID;

    const sql = `
        SELECT available_rooms.RoomID, available_rooms.RoomNumber, available_rooms.BasePrice,
               available_rooms.MaxOccupancy, Room_Class.ClassType, available_rooms.RoomImage
        FROM available_rooms
                 JOIN Room_Class ON available_rooms.RoomClassID = Room_Class.RoomClassID
        WHERE available_rooms.HotelID = ?
    `;

    try {
        const [rows] = await db.promise().query(sql, [hotelID]);

        const rooms = rows.map(room => ({
            ...room,
            RoomImage: room.RoomImage ? room.RoomImage.toString('base64') : null
        }));

        res.status(200).json(rooms);
    } catch (err) {
        console.error("Error fetching available rooms:", err);
        res.status(500).send("Error fetching available rooms");
    }
});


// ✅ Get Room Classes
router.get("/get-room-classes", (req, res) => {
    const sql = "SELECT * FROM Room_Class";

    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching room classes:", err);
            res.status(500).send("Error fetching room classes");
        } else {
            res.status(200).json(result);
        }
    });
});




module.exports = router;
