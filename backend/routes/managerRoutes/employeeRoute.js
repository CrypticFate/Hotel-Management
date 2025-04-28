const express = require("express");
const router = express.Router();
const db = require("../../dbconn");


router.post("/employees", (req, res) => {
    const { hotelID } = req.body;

    const query = `
        SELECT 
            e.EmpID, 
            e.FirstName,
            e.LastName,
            e.Phone,
            e.Email,
            e.hourly_pay,
            e.Role,
            e.working_status,
            e.HiredDate,
            d.DeptName,
            d.DeptID
        FROM Employee e
        INNER JOIN Department d ON e.DeptID = d.DeptID
        WHERE d.HotelID = ? AND e.working_status = 'Working' AND e.Role <> 'manager';
    `;

    db.query(query, [hotelID], (err, results) => {
        if (err) return res.status(500).send("Database error");
        res.json(results);
    });
});



module.exports = router;