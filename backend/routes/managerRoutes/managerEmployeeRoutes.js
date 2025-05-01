// backend/routes/managerEmployeeRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../../dbconn");
const { body, param, query: queryParam, validationResult } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware'); // Assuming middleware exists

// --- Helper: Validation Error Handler ---
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error("Validation Errors:", errors.array());
        return res.status(400).json({
            success: false,
            error: { message: "Validation failed.", details: errors.array({ onlyFirstError: true }) } // Show only first error per field
        });
    }
    next();
};

// --- Validation Rules (Refined for Manager Context) ---
// (Assume employeeValidationRules and updateEmployeeValidationRules are defined similarly to the previous example,
//  but ensure role validation prevents assigning 'manager')

const employeeAddValidationForManager = [
    // deptID validation might need refinement if manager should only add to *their* hotel's depts
    body('deptID').isInt({ gt: 0 }).withMessage('Valid Department ID is required.'),
    body('firstName').trim().notEmpty().withMessage('First name required.').isLength({ max: 50 }),
    body('lastName').trim().notEmpty().withMessage('Last name required.').isLength({ max: 50 }),
    body('phone').trim().optional({ checkFalsy: true }).isLength({ min: 7, max: 20 }).withMessage('Invalid phone format.'),
    body('email').trim().isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('hourlyPay').isFloat({ gt: 0 }).withMessage('Hourly pay must be positive.'),
    body('workingStatus').isIn(['Working', 'Inactive']).withMessage('Invalid working status.'), // Limit options maybe?
    body('role').trim().notEmpty().withMessage('Role required.')
        .isIn(['Receptionist', 'Housekeeping', 'Staff', 'Contractor']) // *** MANAGER CANNOT ADD OTHER MANAGERS ***
        .withMessage('Invalid role specified for manager addition.'),
    body('hiredDate').isISO8601().toDate().withMessage('Invalid hired date.'),
    body('address').optional({ checkFalsy: true }).isJSON().withMessage('Address must be valid JSON.')
];

const employeeUpdateValidationForManager = [
    body('empID').isInt({ gt: 0 }).withMessage('Employee ID required.'),
    body('firstName').optional().trim().notEmpty().isLength({ max: 50 }),
    body('lastName').optional().trim().notEmpty().isLength({ max: 50 }),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ min: 7, max: 20 }),
    body('email').optional().trim().isEmail().normalizeEmail(),
    body('deptID').optional().isInt({ gt: 0 }), // Manager might change dept within their hotel
    body('hourlyPay').optional().isFloat({ gt: 0 }), // Manager *might* update pay? Depends on policy.
    body('workingStatus').optional().isIn(['Working', 'Inactive']),
    body('hiredDate').optional().isISO8601().toDate(),
    // Role update is often restricted or disallowed for managers
    body('role').not().exists().withMessage('Role updates are not permitted via this endpoint for managers.'),
    // Address update
    body('address').optional({ checkFalsy: true }).isJSON().withMessage('Address must be valid JSON.')
];


// === ROUTES ===

// Apply authentication and manager role authorization to all routes in this file
// IMPORTANT: The authorizeRole middleware should also likely check
// that actions are scoped to the manager's req.user.hotelId
router.use(authenticateToken);
router.use(authorizeRole(['manager'])); // Only allow managers

/**
 * @route   GET /api/manager/employees
 * @desc    Get employees for the manager's hotel (filtered)
 * @query   (Optional filters: name, email, phone, role, status, deptId)
 * @access  Private (Manager Only)
 */
router.get("/",
    [ // Optional Query Param validations
        queryParam('name').optional().trim().isLength({ min: 1 }),
        queryParam('email').optional().trim().isEmail(),
        queryParam('phone').optional().trim().isLength({ min: 7 }),
        queryParam('role').optional().trim().isIn(['Receptionist', 'Housekeeping', 'Staff', 'Contractor']), // Limit filterable roles
        queryParam('status').optional().isIn(['Working', 'Inactive']),
        queryParam('deptId').optional().isInt({ gt: 0 })
    ],
    handleValidationErrors,
    async (req, res) => {
        const managerHotelId = req.user.hotelId; // Get hotel ID from authenticated user session/token
        const { name, email, phone, role, status, deptId } = req.query;

        let query = `
            SELECT E.EmpID, E.FirstName, E.LastName, CONCAT(E.FirstName, ' ', E.LastName) AS FullName,
                   E.Phone, E.Email, E.hourly_pay, E.Role, E.working_status, E.HiredDate, E.Address,
                   D.DeptName, D.DeptID
            FROM Employee E
            JOIN Department D ON E.DeptID = D.DeptID
            WHERE D.HotelID = ? AND E.Role <> 'manager' AND E.FirstName <> 'System'
        `; // Manager cannot see other managers or system user
        const params = [managerHotelId];

        if (name) { query += " AND CONCAT(E.FirstName, ' ', E.LastName) LIKE ?"; params.push(`%${name}%`); }
        if (email) { query += " AND E.Email LIKE ?"; params.push(`%${email}%`); }
        if (phone) { query += " AND E.Phone LIKE ?"; params.push(`%${phone}%`); }
        if (role) { query += " AND E.Role = ?"; params.push(role); }
        if (status) { query += " AND E.working_status = ?"; params.push(status); }
        if (deptId) { query += " AND E.DeptID = ?"; params.push(deptId); }

        query += " ORDER BY E.LastName, E.FirstName;";

        try {
            const results = await db.query(query, params);
            res.json({ success: true, data: results });
        } catch (err) {
            console.error("Error fetching manager's employees:", err);
            res.status(500).json({ success: false, error: { message: "Database error fetching employees." } });
        }
});

/**
 * @route   GET /api/manager/employees/departments
 * @desc    Get departments ONLY for the manager's hotel
 * @access  Private (Manager Only)
 */
router.get("/departments", async (req, res) => {
    const managerHotelId = req.user.hotelId;
    const query = `SELECT DeptID, DeptName FROM Department WHERE HotelID = ? ORDER BY DeptName;`;
    try {
        const results = await db.query(query, [managerHotelId]);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error("Error fetching manager's departments:", err);
        res.status(500).json({ success: false, error: { message: "Error fetching departments." } });
    }
});

/**
 * @route   POST /api/manager/employees/add
 * @desc    Add a new non-manager employee to the manager's hotel
 * @access  Private (Manager Only)
 */
router.post("/add",
    employeeAddValidationForManager, // Use manager-specific validation
    handleValidationErrors,
    async (req, res) => {
        const managerHotelId = req.user.hotelId;
        const { deptID, firstName, lastName, phone, email, hourlyPay, workingStatus, role, hiredDate, address } = req.body;

        // Security Check: Ensure the DeptID belongs to the manager's hotel
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
             const [deptCheck] = await connection.query('SELECT 1 FROM Department WHERE DeptID = ? AND HotelID = ?', [deptID, managerHotelId]);
             if (deptCheck.length === 0) {
                  await connection.rollback();
                  return res.status(403).json({ success: false, error: { message: "Cannot add employee to a department outside your hotel." } });
             }

            const addressString = (address && typeof address === 'object') ? JSON.stringify(address) : address;
            const query = `
                INSERT INTO Employee (DeptID, FirstName, LastName, Phone, Email, hourly_pay, working_status, Role, HiredDate, Address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            const [result] = await connection.query(query, [deptID, firstName, lastName, phone || null, email, hourlyPay, workingStatus, role, hiredDate, addressString || null]);

             await connection.commit();
             res.status(201).json({ success: true, message: "Employee added successfully.", data: { empID: result.insertId } });

        } catch (err) {
             await connection.rollback();
             console.error("Manager error adding employee:", err);
             if (err.code === 'ER_DUP_ENTRY') {
                  return res.status(409).json({ success: false, error: { message: "Employee with this email or phone might already exist." } });
             }
             res.status(500).json({ success: false, error: { message: "Database error adding employee." } });
        } finally {
             connection.release();
        }
    }
);

/**
 * @route   PUT /api/manager/employees/update
 * @desc    Update an employee within the manager's hotel (restrictions apply)
 * @access  Private (Manager Only)
 */
router.put("/update",
    employeeUpdateValidationForManager, // Use manager-specific validation
    handleValidationErrors,
    async (req, res) => {
        const managerHotelId = req.user.hotelId;
        const { empID, firstName, lastName, phone, email, deptID, hourlyPay, workingStatus, hiredDate, address } = req.body;

        // Security check: Ensure the employee being updated belongs to the manager's hotel AND is not another manager
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
             const [empCheck] = await connection.query(
                 `SELECT 1 FROM Employee e JOIN Department d ON e.DeptID = d.DeptID
                  WHERE e.EmpID = ? AND d.HotelID = ? AND e.Role <> 'manager'`, // Check hotel and role
                 [empID, managerHotelId]
             );
             if (empCheck.length === 0) {
                  await connection.rollback();
                  return res.status(403).json({ success: false, error: { message: "Permission denied: Cannot update this employee or employee not found in your hotel." } });
             }

             // Security Check: If DeptID is being changed, ensure it also belongs to the manager's hotel
             if (deptID) {
                 const [deptCheck] = await connection.query('SELECT 1 FROM Department WHERE DeptID = ? AND HotelID = ?', [deptID, managerHotelId]);
                 if (deptCheck.length === 0) {
                      await connection.rollback();
                      return res.status(403).json({ success: false, error: { message: "Cannot move employee to a department outside your hotel." } });
                 }
             }

            // Build dynamic update query
            let fieldsToUpdate = [];
            let queryParams = [];
            const addField = (field, value) => { if (value !== undefined) { fieldsToUpdate.push(`${field} = ?`); queryParams.push(value === '' ? null : value); } }; // Helper to handle optional fields and nulls

            addField('FirstName', firstName);
            addField('LastName', lastName);
            addField('Phone', phone);
            addField('Email', email);
            addField('DeptID', deptID);
            addField('hourly_pay', hourlyPay);
            addField('working_status', workingStatus);
            addField('HiredDate', hiredDate ? formatDate(hiredDate) : undefined); // Ensure correct date format if provided
            // Handle Address update (assuming it's JSON)
             if (address !== undefined) {
                 const addressString = (address && typeof address === 'object') ? JSON.stringify(address) : address;
                 addField('Address', addressString || null);
             }

            if (fieldsToUpdate.length === 0) {
                 await connection.rollback();
                 return res.status(400).json({ success: false, error: { message: "No fields provided for update." } });
            }

            const updateQuery = `UPDATE Employee SET ${fieldsToUpdate.join(', ')} WHERE EmpID = ?`;
            queryParams.push(empID);

            const [result] = await connection.query(updateQuery, queryParams);

             await connection.commit();

             if (result.affectedRows === 0) { // Should have been caught by initial check, but good safeguard
                  return res.status(404).json({ success: false, error: { message: "Employee not found (concurrent modification?)." } });
             }
             res.json({ success: true, message: "Employee updated successfully." });

        } catch (err) {
             await connection.rollback();
             console.error("Manager error updating employee:", err);
              if (err.code === 'ER_DUP_ENTRY') {
                   return res.status(409).json({ success: false, error: { message: "Update failed: Email or phone may already exist for another employee." } });
              }
             res.status(500).json({ success: false, error: { message: "Database error updating employee." } });
        } finally {
             connection.release();
        }
    }
);


/**
 * @route   PATCH /api/manager/employees/:empID/status
 * @desc    Deactivate (soft delete) an employee in the manager's hotel
 * @access  Private (Manager Only)
 */
router.patch("/:empID/status",
    param('empID').isInt({ gt: 0 }).withMessage('Valid Employee ID parameter is required.'),
    [ body('status').isIn(['Inactive', 'Working']).withMessage('Status must be "Inactive" or "Working".') ], // Allow reactivation too?
    handleValidationErrors,
    async (req, res) => {
        const managerHotelId = req.user.hotelId;
        const { empID } = req.params;
        const { status } = req.body; // 'Inactive' or 'Working'

        // Ensure manager is changing status of a non-manager employee in their hotel
        const updateQuery = `
            UPDATE Employee e JOIN Department d ON e.DeptID = d.DeptID
            SET e.working_status = ?
            WHERE e.EmpID = ? AND d.HotelID = ? AND e.Role <> 'manager';
        `;

        try {
            const [result] = await db.query(updateQuery, [status, empID, managerHotelId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: { message: "Employee not found in your hotel, is already in that status, or is a manager." } });
            }
            res.json({ success: true, message: `Employee status updated to ${status}.` });
        } catch (err) {
            console.error(`Manager error updating employee ${empID} status:`, err);
            res.status(500).json({ success: false, error: { message: "Database error updating employee status." } });
        }
});


module.exports = router;