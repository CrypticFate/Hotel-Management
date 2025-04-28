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

router.post("/add-employee", (req, res) => {
    const { deptID, firstName, lastName, phone, email, hourlyPay, salary, workingStatus, role, hiredDate, address } = req.body;

    const query = `
        INSERT INTO Employee (DeptID, FirstName, LastName, Phone, Email, hourly_pay, working_status, Role, HiredDate, Address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    // Make sure address is passed as an object and let the database handle the JSON formatting.
    db.query(query, [deptID, firstName, lastName, phone, email, hourlyPay, workingStatus, role, hiredDate, address], (err, result) => {
        if (err) {
            console.error("Error adding employee:", err);
            return res.status(500).send("Error adding employee.");
        }
        res.send("Employee added successfully.");
    });
});


router.post("/update-employee", (req, res) => {
    const {
        empID, firstName, lastName, phone, email,
        deptName, hotelID, hourlyPay, role, workingStatus, hiredDate
    } = req.body;

    const findDeptQuery = `
        SELECT DeptID FROM Department
        WHERE DeptName = ? AND HotelID = ?
        LIMIT 1
    `;

    db.query(findDeptQuery, [deptName, hotelID], (err, deptResult) => {
        if (err) {
            console.error("Error fetching department ID:", err);
            return res.status(500).send("Error finding department.");
        }

        if (deptResult.length === 0) {
            return res.status(404).send("Department not found.");
        }

        const deptID = deptResult[0].DeptID;

        const updateQuery = `
            UPDATE Employee
            SET FirstName = ?, LastName = ?, Phone = ?, Email = ?,
                hourly_pay = ?, Role = ?, working_status = ?, HiredDate = ?, DeptID = ?
            WHERE EmpID = ?
        `;

        db.query(updateQuery, [
            firstName, lastName, phone, email,
            hourlyPay, role, workingStatus, hiredDate,
            deptID, empID
        ], (err, result) => {
            if (err) {
                console.error("Error updating employee:", err);
                return res.status(500).send("Error updating employee.");
            }

            res.send("Employee updated successfully.");
        });
    });
});


router.post("/filter-employees", (req, res) => {
    const { hotelID, FullName, Phone, Email, Role, Status } = req.body;

    let query = `
        SELECT E.*, D.DeptName
        FROM Employee E
        JOIN Department D ON E.DeptID = D.DeptID
        WHERE D.HotelID = ? AND E.Role <> 'manager' AND E.FirstName <> 'System'
    `;
    let params = [hotelID];

    if (FullName) {
        query += " AND CONCAT(E.FirstName, ' ', E.LastName) LIKE ?";
        params.push(`%${FullName}%`);
    }
    if (Phone) {
        query += " AND E.Phone LIKE ?";
        params.push(`%${Phone}%`);
    }
    if (Email) {
        query += " AND E.Email LIKE ?";
        params.push(`%${Email}%`);
    }
    if (Role) {
        query += " AND E.Role LIKE ?";
        params.push(`%${Role}%`);
    }
    if (Status) {
        query += " AND E.working_status = ?";
        params.push(Status);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Error filtering employees:", err);
            return res.status(500).send("Error filtering employees.");
        }
        res.send(results);
    });
});




module.exports = router;