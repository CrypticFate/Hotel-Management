// backend/routes/employees.js  (Example file path)

const express = require("express");
const router = express.Router();
const db = require("../../dbconn"); // Assuming dbconn exports a promise-based query function or is wrapped
const { body, validationResult, param } = require('express-validator');
const util = require('util'); // If needed to promisify db.query

// --- Promisify db.query if it's callback-based ---
// const queryPromise = util.promisify(db.query).bind(db);
// Replace db.query below with queryPromise if you need this

// --- Helper Function for Validation Errors ---
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Log detailed errors for debugging
        console.error("Validation Errors:", errors.array());
        // Send a user-friendly error response
        return res.status(400).json({
            success: false,
            error: {
                message: "Validation failed.",
                details: errors.array().map(err => ({ field: err.param, message: err.msg })) // Send simplified details
            }
        });
    }
    next();
};

// --- Validation Chains ---
const employeeValidationRules = [
    body('deptID').isInt({ gt: 0 }).withMessage('Valid Department ID is required.'),
    body('firstName').trim().notEmpty().withMessage('First name is required.').isLength({ max: 50 }).withMessage('First name too long.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.').isLength({ max: 50 }).withMessage('Last name too long.'),
    body('phone').trim().optional({ checkFalsy: true }).isLength({ min: 7, max: 20 }).withMessage('Invalid phone number format.'), // Optional but validated if present
    body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('hourlyPay').isFloat({ gt: 0 }).withMessage('Hourly pay must be a positive number.'),
    body('workingStatus').isIn(['Working', 'Inactive', 'Not Working']).withMessage('Invalid working status.'),
    body('role').trim().notEmpty().withMessage('Role is required.')
        .isIn(['Receptionist', 'Housekeeping', 'Staff', 'Contractor']) // Disallow setting 'Manager' directly
        .withMessage('Invalid or disallowed role specified. Manager role cannot be assigned here.'),
    body('hiredDate').isISO8601().toDate().withMessage('Invalid hired date format.'),
    // Validate address if needed - checking if it's an object or valid JSON string
    body('address').optional({ checkFalsy: true }).custom((value) => {
        try {
            if (typeof value === 'string') JSON.parse(value);
            else if (typeof value !== 'object') throw new Error();
            return true;
        } catch (e) {
            throw new Error('Address must be a valid JSON string or object.');
        }
    })
];

const updateEmployeeValidationRules = [
    // Ensure empID is passed correctly (often in URL params for PUT)
    // param('empID').isInt({ gt: 0 }).withMessage('Valid Employee ID parameter is required.'), // If using URL param
    body('empID').isInt({ gt: 0 }).withMessage('Valid Employee ID is required in the body.'), // If using body
    body('firstName').trim().notEmpty().withMessage('First name is required.').isLength({ max: 50 }),
    body('lastName').trim().notEmpty().withMessage('Last name is required.').isLength({ max: 50 }),
    body('phone').trim().optional({ checkFalsy: true }).isLength({ min: 7, max: 20 }).withMessage('Invalid phone format.'),
    body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('deptName').trim().notEmpty().withMessage('Department name is required.'), // Update needs DeptName to find ID
    body('hourlyPay').isFloat({ gt: 0 }).withMessage('Hourly pay must be positive.'),
    body('role').trim().notEmpty().withMessage('Role is required.')
         .isIn(['Receptionist', 'Housekeeping', 'Staff', 'Contractor']) // Still disallow direct update to 'Manager'
         .withMessage('Invalid or disallowed role specified. Cannot update to Manager via this route.'),
    body('workingStatus').isIn(['Working', 'Inactive', 'Not Working']).withMessage('Invalid working status.'),
    body('hiredDate').isISO8601().toDate().withMessage('Invalid hired date.'),
    body('hotelID').isInt({ gt: 0 }).withMessage('Hotel ID is required.') // Needed for Dept lookup
];

// --- Routes ---

/**
 * @route   GET /api/employees/:hotelID
 * @desc    Get all working employees for a specific hotel (excluding managers)
 * @access  Private (requires authentication/authorization middleware - not shown)
 */
router.get("/:hotelID",
    param('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;

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
                e.Address, -- Include Address
                d.DeptName,
                d.DeptID
            FROM Employee e
            INNER JOIN Department d ON e.DeptID = d.DeptID
            WHERE d.HotelID = ? AND e.working_status = 'Working' AND e.Role <> 'manager' AND e.FirstName <> 'System';
        `; // Exclude 'System' user

        try {
            const results = await db.query(query, [hotelID]); // Assumes promise-based query
            // Enhance data before sending if needed (like combining name)
            const enhancedResults = results.map(emp => ({
                 ...emp,
                 FullName: `${emp.FirstName} ${emp.LastName}` // Add FullName for convenience
            }));
            res.json({ success: true, data: enhancedResults });
        } catch (err) {
            console.error("Database error fetching employees:", err);
            res.status(500).json({ success: false, error: { message: "Failed to retrieve employees." } });
        }
});

/**
 * @route   POST /api/employees/add
 * @desc    Add a new employee
 * @access  Private (Manager role likely required)
 */
router.post("/add",
    employeeValidationRules, // Apply validation rules
    handleValidationErrors, // Handle any validation errors
    async (req, res) => {
        // Extract validated and sanitized data
        const { deptID, firstName, lastName, phone, email, hourlyPay, workingStatus, role, hiredDate, address } = req.body;

        // Convert address object to JSON string if it's an object
        const addressString = (address && typeof address === 'object') ? JSON.stringify(address) : address;

        const query = `
            INSERT INTO Employee (DeptID, FirstName, LastName, Phone, Email, hourly_pay, working_status, Role, HiredDate, Address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        try {
            // Optional: Check if DeptID actually exists for the hotel before inserting
            // const deptCheck = await db.query('SELECT 1 FROM Department WHERE DeptID = ? AND HotelID = ?', [deptID, req.body.hotelID]); // Assuming hotelID is available
            // if (deptCheck.length === 0) {
            //     return res.status(400).json({ success: false, error: { message: "Specified department does not exist for this hotel." } });
            // }

            const result = await db.query(query, [deptID, firstName, lastName, phone || null, email, hourlyPay, workingStatus, role, hiredDate, addressString || null]);

            res.status(201).json({ success: true, message: "Employee added successfully.", data: { empID: result.insertId } }); // Return new ID
        } catch (err) {
            console.error("Error adding employee:", err);
            // Check for specific DB errors like duplicate email/phone if constraints exist
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(409).json({ success: false, error: { message: "Employee with this email or phone already exists." } });
            }
            res.status(500).json({ success: false, error: { message: "Database error adding employee." } });
        }
    }
);

/**
 * @route   PUT /api/employees/update
 * @desc    Update an existing employee's details
 * @access  Private (Manager role likely required)
 */
router.put("/update",
    updateEmployeeValidationRules, // Apply validation rules
    handleValidationErrors, // Handle validation errors
    async (req, res) => {
        const {
            empID, firstName, lastName, phone, email,
            deptName, hotelID, hourlyPay, role, workingStatus, hiredDate
            // Note: Address update might need specific handling if passed
        } = req.body;

        // Use a transaction to ensure department lookup and update are atomic
        const connection = await db.getConnection(); // Assumes getConnection for transactions
        await connection.beginTransaction();

        try {
            // 1. Find Department ID based on Name and HotelID
            const findDeptQuery = `SELECT DeptID FROM Department WHERE DeptName = ? AND HotelID = ? LIMIT 1`;
            const [deptResult] = await connection.query(findDeptQuery, [deptName, hotelID]); // Use connection for transaction queries

            if (!deptResult || deptResult.length === 0) {
                 await connection.rollback(); // Rollback transaction
                return res.status(404).json({ success: false, error: { message: `Department '${deptName}' not found for this hotel.` } });
            }
            const deptID = deptResult[0].DeptID;

            // 2. Update Employee Record
            const updateQuery = `
                UPDATE Employee
                SET FirstName = ?, LastName = ?, Phone = ?, Email = ?,
                    hourly_pay = ?, Role = ?, working_status = ?, HiredDate = ?, DeptID = ?
                WHERE EmpID = ?
            `;
            const [updateResult] = await connection.query(updateQuery, [
                firstName, lastName, phone || null, email,
                hourlyPay, role, workingStatus, hiredDate,
                deptID, empID
            ]);

             if (updateResult.affectedRows === 0) {
                 await connection.rollback();
                 return res.status(404).json({ success: false, error: { message: `Employee with ID ${empID} not found.` } });
             }

            // 3. Commit Transaction
            await connection.commit();

            res.json({ success: true, message: "Employee updated successfully." });

        } catch (err) {
            await connection.rollback(); // Rollback on any error
            console.error("Error updating employee:", err);
             if (err.code === 'ER_DUP_ENTRY') {
                  return res.status(409).json({ success: false, error: { message: "Update failed: Email or phone may already exist for another employee." } });
             }
            res.status(500).json({ success: false, error: { message: "Database error updating employee." } });
        } finally {
            connection.release(); // Always release the connection
        }
    }
);


/**
 * @route   POST /api/employees/filter
 * @desc    Filter employees based on criteria
 * @access  Private
 */
router.post("/filter", async (req, res) => {
    // Consider adding validation for filter inputs if needed
    const { hotelID, FullName, Phone, Email, Role, Status } = req.body;

    if (!hotelID || isNaN(parseInt(hotelID))) {
         return res.status(400).json({ success: false, error: { message: "Valid Hotel ID is required." } });
    }

    let query = `
        SELECT E.EmpID, E.FirstName, E.LastName, E.Phone, E.Email, E.hourly_pay, E.Role, E.working_status, E.HiredDate, E.Address, D.DeptName, D.DeptID
        FROM Employee E
        JOIN Department D ON E.DeptID = D.DeptID
        WHERE D.HotelID = ? AND E.Role <> 'manager' AND E.FirstName <> 'System'
    `;
    let params = [hotelID];

    // Append filters safely using placeholders
    if (FullName) {
        query += " AND CONCAT(E.FirstName, ' ', E.LastName) LIKE ?";
        params.push(`%${FullName}%`); // Consider sanitizing FullName further if needed
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
    if (Status && ['Working', 'Inactive', 'Not Working'].includes(Status)) { // Validate Status value
        query += " AND E.working_status = ?";
        params.push(Status);
    }
    // Add ORDER BY for consistent results
    query += " ORDER BY E.LastName, E.FirstName";

    try {
        const results = await db.query(query, params);
         const enhancedResults = results.map(emp => ({
             ...emp,
             FullName: `${emp.FirstName} ${emp.LastName}`
        }));
        res.json({ success: true, data: enhancedResults });
    } catch (err) {
        console.error("Error filtering employees:", err);
        res.status(500).json({ success: false, error: { message: "Error filtering employees." } });
    }
});


/**
 * @route   GET /api/employees/details/:empID
 * @desc    Get details for a single employee
 * @access  Private
 */
router.get("/details/:empID",
    param('empID').isInt({ gt: 0 }).withMessage('Valid Employee ID parameter is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { empID } = req.params;

        const query = `
            SELECT
                e.EmpID, e.DeptID, e.FirstName, e.LastName, e.Phone, e.Email,
                e.hourly_pay, e.Salary, e.Role, e.HiredDate, e.Address, e.working_status, d.DeptName
            FROM Employee e
            INNER JOIN Department d ON e.DeptID = d.DeptID
            WHERE e.EmpID = ?;
        `;

        try {
            const [results] = await db.query(query, [empID]); // Use array destructuring if your lib returns [rows, fields]
            if (!results || results.length === 0) {
                return res.status(404).json({ success: false, error: { message: "Employee not found." } });
            }
             // Enhance data before sending
            const employeeDetails = {
                ...results[0],
                FullName: `${results[0].FirstName} ${results[0].LastName}`
            };
            res.json({ success: true, data: employeeDetails });
        } catch (err) {
            console.error("Error fetching employee details:", err);
            res.status(500).json({ success: false, error: { message: "Error fetching employee details." } });
        }
});

/**
 * @route   DELETE /api/employees/:empID
 * @desc    Remove (or deactivate) an employee
 * @access  Private (Manager role likely required)
 */
router.delete("/:empID",
     param('empID').isInt({ gt: 0 }).withMessage('Valid Employee ID parameter is required.'),
     handleValidationErrors,
     async (req, res) => {
          const { empID } = req.params;

          // --- Option 1: Hard Delete (Permanent) ---
          // const deleteQuery = `DELETE FROM Employee WHERE EmpID = ?`;

          // --- Option 2: Soft Delete (Set status to Inactive) ---
          const deleteQuery = `UPDATE Employee SET working_status = 'Inactive' WHERE EmpID = ? AND Role <> 'manager'`; // Prevent deactivating managers this way

          try {
               const [result] = await db.query(deleteQuery, [empID]);

               if (result.affectedRows === 0) {
                    // Could be not found OR trying to deactivate a manager (if using soft delete query above)
                   return res.status(404).json({ success: false, error: { message: "Employee not found or cannot be deactivated." } });
               }

               res.json({ success: true, message: "Employee successfully deactivated." }); // Adjust message for hard delete
          } catch (err) {
               console.error("Error removing/deactivating employee:", err);
               // Consider foreign key constraints if using hard delete
               res.status(500).json({ success: false, error: { message: "Database error processing employee removal." } });
          }
});


// === Department Route ===

/**
 * @route   GET /api/employees/departments/:hotelID
 * @desc    Fetch Available Departments for the Hotel
 * @access  Private
 */
router.get("/departments/:hotelID",
    param('hotelID').isInt({ gt: 0 }).withMessage('Valid Hotel ID parameter is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { hotelID } = req.params;
        const query = `SELECT DeptID, DeptName FROM Department WHERE HotelID = ? ORDER BY DeptName;`;

        try {
            const results = await db.query(query, [hotelID]);
            res.json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching departments:", err);
            res.status(500).json({ success: false, error: { message: "Error fetching departments." } });
        }
});


// --- Deprecated/Combined Routes (Example: Update Pay could be part of general update) ---
/*
// Update hourly pay (Consider using PUT /api/employees/:empID/pay or integrating into the main PUT /api/employees/update)
router.post("/update-hourly-pay", (req, res) => {
    // ... (keep validation, but preferably use PUT/PATCH and the main update route)
});
*/

module.exports = router;