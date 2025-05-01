// --- START OF FILE Employee.js ---

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getFilteredRowModel, // Optional: if using client-side filtering
    getSortedRowModel,   // Optional: if using client-side sorting
    flexRender,
} from '@tanstack/react-table';
import Navbar from "../../components/Navbar";
import "./ManagerView.css"; // Import updated CSS
import { // Import more icons
    FiUsers, FiPlus, FiFilter, FiEdit2, FiSave, FiXCircle, FiTrash2,
    FiAlertTriangle, FiUserCheck, FiChevronLeft, FiChevronRight, FiX, FiBriefcase, FiDollarSign, FiPhone, FiMail, FiCalendar, FiCheckSquare, FiSearch, FiRotateCcw
} from "react-icons/fi";

// Helper function to format date consistently
const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Format to YYYY-MM-DD for date inputs
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return ''; // Return empty string or invalid date indicator
    }
};
const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (e) { return 'Invalid Date'; }
};

const Employee = () => {
    const navigate = useNavigate();
    const hotelID = localStorage.getItem("hotelID");

    // --- Core Data State ---
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);

    // --- UI Control State ---
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddFormModal, setShowAddFormModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // --- Form/Edit State ---
    const [newEmployee, setNewEmployee] = useState(null); // For Add form data
    const [formErrors, setFormErrors] = useState({});
    const [editingEmployeeId, setEditingEmployeeId] = useState(null);
    const [originalEmployeeData, setOriginalEmployeeData] = useState(null); // Store original row data before edit
    const [employeeToRemove, setEmployeeToRemove] = useState(null);

    // --- Filter State ---
    const [filters, setFilters] = useState({
        FullName: '', Phone: '', Email: '', Role: '', Status: '', DeptID: '' // Added DeptID filter
    });

    // --- Action States ---
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);


    // --- Fetching Logic ---
    const fetchBackendData = useCallback(async (endpoint, payload, showLoader = true) => {
        if (!hotelID) {
            setError("Hotel ID missing. Please log in.");
            setIsLoading(false);
            return null; // Indicate failure
        }
        if (showLoader) setIsLoading(true);
        setError(null);
        try {
            const response = await Axios.post(endpoint, payload); // Assuming POST, adjust if needed
            return response.data; // Assuming backend sends { success: true, data: ... } or similar
        } catch (err) {
            console.error(`Error fetching ${endpoint}:`, err);
            const errMsg = err.response?.data?.error?.message || `Failed to load data from ${endpoint}.`;
            setError(errMsg);
            if (endpoint.includes('/employees') || endpoint.includes('/filter-employees')) {
                setEmployees([]); // Clear relevant data on error
            } else if (endpoint.includes('/departments')) {
                setDepartments([]);
            }
            return null; // Indicate failure
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, [hotelID]); // Dependency on hotelID

    const fetchEmployees = useCallback((filtersToApply = filters, showLoader = true) => {
        const filterActive = Object.values(filtersToApply).some(val => val !== '' && val !== null);
        const endpoint = filterActive ? "/api/employees/filter" : "/api/employees"; // Use updated backend routes
        const payload = filterActive ? { hotelID, ...filtersToApply } : { hotelID };
        fetchBackendData(endpoint, payload, showLoader).then(data => {
            if (data && data.success) {
                setEmployees(data.data || []); // Assuming data is in data.data
            }
            // Error is handled by fetchBackendData setting the error state
        });
    }, [hotelID, filters, fetchBackendData]); // Depend on filters state

    const fetchDepartments = useCallback(() => {
        fetchBackendData("/api/employees/departments", { hotelID }, false).then(data => { // Assuming backend route like this
            if (data && data.success) {
                setDepartments(data.data || []);
            }
        });
    }, [hotelID, fetchBackendData]);

    useEffect(() => {
        fetchEmployees(); // Initial fetch
        fetchDepartments();
    }, [fetchEmployees, fetchDepartments]); // Callbacks ensure stable dependencies


    // --- Filter Logic ---
    const applyFilters = () => {
        setShowFilterModal(false);
        fetchEmployees(filters, true); // Fetch based on current filters state with loader
    };

    const clearFilters = () => {
        const clearedFilters = { FullName: '', Phone: '', Email: '', Role: '', Status: '', DeptID: '' };
        setFilters(clearedFilters);
        setShowFilterModal(false);
        fetchEmployees(clearedFilters, true); // Fetch immediately after clearing
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };


    // --- Inline Edit Logic ---
    const startEditing = (row) => {
        setOriginalEmployeeData({ ...row.original }); // Store original state
        setEditingEmployeeId(row.original.EmpID);
    };

    const handleEditChange = (empID, field, value) => {
        // Basic client-side validation during edit (optional)
        if (field === "Role" && value.toLowerCase() === "manager") {
            alert("Role cannot be set to 'Manager' via this interface.");
            // Optionally revert visually, or just prevent saving later
            return; // Don't update state if invalid
        }
        if (field === "Role") { value = value.trim(); }

        setEmployees(prev =>
            prev.map(emp => emp.EmpID === empID ? { ...emp, [field]: value } : emp)
        );
    };

    const handleCancelEdit = () => {
        if (originalEmployeeData) {
            setEmployees(prev => prev.map(emp => emp.EmpID === originalEmployeeData.EmpID ? { ...originalEmployeeData } : emp));
        }
        setEditingEmployeeId(null);
        setOriginalEmployeeData(null);
    };

    const handleUpdate = async (employee) => {
        setIsUpdating(true);
        setError(null); // Clear previous errors

        // --- Validation before sending ---
        const pay = parseFloat(employee.hourly_pay);
        if (isNaN(pay) || pay < 0) { alert("Invalid Hourly Pay value."); setIsUpdating(false); return; }
        if (!employee.FullName?.trim()) { alert("Full Name is required."); setIsUpdating(false); return; }
        // Add more validation as needed (email format, phone format, etc.)
        // --- End Validation ---

        // Find DeptID based on potentially edited DeptName
        const selectedDept = departments.find(d => d.DeptName === employee.DeptName);
        if (!selectedDept) {
             alert(`Invalid department selected: ${employee.DeptName}`);
             setIsUpdating(false);
             return;
        }

        const updatedData = {
            empID: employee.EmpID,
            firstName: employee.FullName.split(" ")[0] || '',
            lastName: employee.FullName.split(" ").slice(1).join(" ") || '',
            phone: employee.Phone || null,
            email: employee.Email,
            // Send DeptID instead of DeptName if backend expects ID
            deptID: selectedDept.DeptID, // Use the found ID
            // OR send deptName if backend handles lookup: deptName: employee.DeptName,
            hourlyPay: pay,
            role: employee.Role, // Already validated it's not 'Manager'
            workingStatus: employee.working_status,
            hiredDate: formatDate(employee.HiredDate), // Ensure YYYY-MM-DD format
            hotelID: hotelID, // Needed if backend doesn't get from session/auth
            // Include Address if editable
            // address: employee.Address ? JSON.stringify(employee.Address) : null
        };

        try {
             // Use PUT /api/employees/update
            const response = await Axios.put(`/api/employees/update`, updatedData); // Use PUT
            if (response.data.success) {
                // alert("Employee updated successfully."); // Use toast
                console.log("Update successful");
                setEditingEmployeeId(null);
                setOriginalEmployeeData(null);
                fetchEmployees(filters, false); // Refresh without full loader
            } else {
                throw new Error(response.data.error?.message || "Update failed on server.");
            }
        } catch (err) {
            console.error("Update failed:", err);
            const errMsg = err.response?.data?.error?.message || err.message || "Failed to update employee.";
            setError(`Update Failed: ${errMsg}`); // Show error to user
            // Optionally revert changes on failure
            handleCancelEdit();
        } finally {
            setIsUpdating(false);
        }
    };


    // --- Add Employee Logic ---
    const handleShowAddForm = () => {
        setNewEmployee({ // Initialize with defaults
            FirstName: '', LastName: '', Phone: '', Email: '', DeptID: '',
            hourly_pay: '', Role: '', working_status: 'Working',
            HiredDate: formatDate(new Date()), Address: { city: '', state: '' }
        });
        setFormErrors({});
        setShowAddFormModal(true); // Open modal
    };

    const handleNewEmployeeInputChange = (e) => {
        const { name, value } = e.target;
         // Handle nested address fields
         if (name === 'city' || name === 'state') {
             setNewEmployee(prev => ({
                 ...prev,
                 Address: { ...prev.Address, [name]: value }
             }));
         } else {
             setNewEmployee(prev => ({ ...prev, [name]: value }));
         }
    };

    const validateForm = () => { /* Keep existing validation logic, refine as needed */
        const errors = {};
        if (!newEmployee.FirstName?.trim()) errors.FirstName = "First name is required";
        if (!newEmployee.LastName?.trim()) errors.LastName = "Last name is required";
        if (!newEmployee.Phone?.trim()) errors.Phone = "Phone is required";
         if (newEmployee.Email && !/\S+@\S+\.\S+/.test(newEmployee.Email)) errors.Email = "Invalid email format";
        if (!newEmployee.DeptID) errors.DeptID = "Department is required";
        if (!newEmployee.hourly_pay || isNaN(parseFloat(newEmployee.hourly_pay)) || parseFloat(newEmployee.hourly_pay) < 0) errors.hourly_pay = "Valid hourly pay required";
        if (!newEmployee.Role) errors.Role = "Role is required";
         if (newEmployee.Role.toLowerCase() === 'manager') errors.Role = "Manager role cannot be assigned here.";

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveNewEmployee = async () => {
        if (!validateForm()) return;
        setIsSaving(true);
        setError(null);

        const dataToSend = {
            hotelID: hotelID, deptID: newEmployee.DeptID,
            firstName: newEmployee.FirstName.trim(), lastName: newEmployee.LastName.trim(),
            phone: newEmployee.Phone.trim(), email: newEmployee.Email.trim() || null, // Allow empty email if optional
            hourlyPay: parseFloat(newEmployee.hourly_pay), workingStatus: newEmployee.working_status,
            role: newEmployee.Role, hiredDate: newEmployee.HiredDate,
            address: (newEmployee.Address?.city || newEmployee.Address?.state) ? JSON.stringify(newEmployee.Address) : null
         };

        try {
            // Use POST /api/employees/add
            const response = await Axios.post("/api/employees/add", dataToSend);
            if (response.data.success) {
                // alert("Employee added successfully!"); // Use toast
                console.log("Add successful");
                fetchEmployees(filters, false);
                setShowAddFormModal(false); // Close modal
            } else {
                throw new Error(response.data.error?.message || "Add failed on server.");
            }
        } catch (err) {
            console.error("Error adding employee:", err);
            const errMsg = err.response?.data?.error?.message || err.message || "Failed to add employee.";
            // Display error within the modal?
            setFormErrors({ general: errMsg }); // Show general error in form
            // setError(`Add Failed: ${errMsg}`); // Or show global error
        } finally {
            setIsSaving(false);
        }
    };

    // --- Remove Employee Logic ---
    const confirmRemoveEmployee = (employee) => {
        setEmployeeToRemove(employee);
        setShowConfirmation(true);
    };

    const handleRemoveEmployee = async () => {
        if (!employeeToRemove) return;
        setIsDeleting(true);
        setError(null);

        try {
             // Use DELETE /api/employees/:empID
            const response = await Axios.delete(`/api/employees/${employeeToRemove.EmpID}`);
            if (response.data.success) {
                // alert("Employee removed successfully."); // Use toast
                console.log("Delete successful");
                fetchEmployees(filters, false); // Refresh list
            } else {
                 throw new Error(response.data.error?.message || "Remove failed on server.");
            }
        } catch (err) {
            console.error("Error removing employee:", err);
            const errMsg = err.response?.data?.error?.message || err.message || "Failed to remove employee.";
            setError(`Delete Failed: ${errMsg}`); // Show global error
        } finally {
            setShowConfirmation(false);
            setEmployeeToRemove(null);
            setIsDeleting(false);
        }
    };

    // --- Table Definition ---
    const columns = useMemo(() => [
        // Define columns as before, using updated icons/styles maybe
         { accessorKey: 'FullName', header: 'Employee', size: 220 },
         { accessorKey: 'DeptName', header: 'Department', size: 160 },
         { id: 'Contact', header: 'Contact', size: 250, cell: info => ( // Combined contact cell
             <div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FiMail size={12} opacity={0.7}/> {info.row.original.Email || '-'}</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}><FiPhone size={12} opacity={0.7}/> {info.row.original.Phone || '-'}</div>
             </div>
         )},
         { accessorKey: 'hourly_pay', header: 'Pay Rate', cell: info => `$${parseFloat(info.getValue() || 0).toFixed(2)}/hr`, size: 100 },
         { accessorKey: 'Role', header: 'Role', size: 140 },
         { accessorKey: 'HiredDate', header: 'Hired', cell: info => formatDateForDisplay(info.getValue()), size: 120 },
         { accessorKey: 'working_status', header: 'Status', cell: info => (
             <span className={`status-badge ${info.getValue()?.toLowerCase().replace(' ','.') || 'unknown'}`}>
                 {info.getValue()}
             </span>
         ), size: 110 },
         { id: 'actions', header: 'Actions', size: 120, cell: ({ row }) => {
             const isEditing = row.original.EmpID === editingEmployeeId;
             return (
                 <div className="table-actions">
                     {isEditing ? (
                         <>
                             <button className="action-button success small" onClick={() => handleUpdate(row.original)} title="Save Changes" disabled={isUpdating}> <FiSave/> </button>
                             <button className="action-button muted small" onClick={handleCancelEdit} title="Cancel Edit" disabled={isUpdating}> <FiXCircle/> </button>
                         </>
                     ) : (
                         <>
                             <button className="action-button warning small" onClick={() => startEditing(row)} title="Edit Employee"> <FiEdit2/> </button>
                             <button className="action-button danger small" onClick={() => confirmRemoveEmployee(row.original)} title="Remove Employee"> <FiTrash2/> </button>
                         </>
                     )}
                 </div>
             );
         }},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [editingEmployeeId, departments, isUpdating]); // Include isUpdating to disable buttons

    const table = useReactTable({
        data: employees, columns,
        getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 10 } }, // Increased page size slightly
    });

    // --- Render Functions ---
    const renderLoading = () => <div className="loading-indicator"><div className="spinner"></div><p>Loading Data...</p></div>;
    const renderError = () => <div className="error-display"><span className="error-icon"><FiAlertTriangle/></span><p>{error}</p><button onClick={() => fetchEmployees(filters, true)} className="action-button secondary small"><FiRotateCcw/> Retry</button></div>;
    const renderNoData = () => <div className="no-data-message"><span className="no-data-icon"><FiUsers/></span><p>No employees found matching the current criteria.</p></div>;

    const renderTableContent = () => (
        <>
            <table className="employee-table">
                <thead>
                    {table.getHeaderGroups().map(hg => ( <tr key={hg.id}>{hg.headers.map(h => <th key={h.id} style={{ width: `${h.getSize()}px` }}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr> ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map(row => (
                        <tr key={row.id}>
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className={editingEmployeeId === row.original.EmpID && ['FullName', 'Phone', 'Email', 'hourly_pay', 'Role', 'HiredDate', 'DeptName', 'working_status'].includes(cell.column.id) ? 'editing' : ''}>
                                    {renderCellContent(cell, row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* Pagination */}
            <div className="pagination-controls">
                <button className="action-button muted small" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}> <FiChevronLeft/> Prev </button>
                <span> Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1} </span>
                <button className="action-button muted small" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}> Next <FiChevronRight/> </button>
            </div>
        </>
    );

    const renderCellContent = (cell, row) => { /* Keep the existing logic from previous response */
         const isEditing = row.original.EmpID === editingEmployeeId;
         const columnId = cell.column.id;
         const value = row.original[columnId]; // Use original value for inputs

         if (isEditing && ['FullName', 'Phone', 'Email', 'hourly_pay', 'Role', 'HiredDate'].includes(columnId)) {
             const inputType = columnId === 'hourly_pay' ? 'number' : columnId === 'HiredDate' ? 'date' : 'text';
             return ( <input type={inputType} step={inputType === 'number' ? '0.01' : undefined} value={inputType === 'date' ? (value ? formatDate(new Date(value)) : '') : value || ''} onChange={(e) => handleEditChange(row.original.EmpID, columnId, e.target.value)} max={inputType === 'date' ? formatDate(new Date()) : undefined}/> );
         }
         if (isEditing && columnId === 'DeptName') {
             return ( <select value={value} onChange={(e) => handleEditChange(row.original.EmpID, columnId, e.target.value)}>{departments.map((d) => (<option key={d.DeptID} value={d.DeptName}>{d.DeptName}</option>))}</select> );
         }
         if (isEditing && columnId === 'working_status') {
             return ( <select value={value} onChange={(e) => handleEditChange(row.original.EmpID, columnId, e.target.value)}><option value="Working">Working</option><option value="Inactive">Inactive</option><option value="Not Working">Not Working</option></select> );
         }
         return flexRender(cell.column.columnDef.cell, cell.getContext());
    };

    const renderAddForm = () => (
        <div className="popup-overlay" onClick={handleCancelAdd}>
             <div className="modal-content add-employee-form-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><FiUserPlus/> Add New Employee</h3>
                    <button className="modal-close-button" onClick={handleCancelAdd} title="Close Form"> <FiX/> </button>
                </div>
                 <form onSubmit={(e) => { e.preventDefault(); handleSaveNewEmployee(); }}>
                    {formErrors.general && <p className="error-message" style={{border: '1px solid var(--danger-color)', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'rgba(244, 63, 94, 0.1)'}}>{formErrors.general}</p>}
                    <div className="form-grid">
                        {/* Use input groups */}
                        <div className="input-group"><label htmlFor="add-firstName">First Name *</label><input id="add-firstName" name="FirstName" type="text" placeholder="John" value={newEmployee.FirstName} onChange={handleNewEmployeeInputChange} className={formErrors.FirstName ? 'error' : ''}/>{formErrors.FirstName && <span className="error-message">{formErrors.FirstName}</span>}</div>
                        <div className="input-group"><label htmlFor="add-lastName">Last Name *</label><input id="add-lastName" name="LastName" type="text" placeholder="Doe" value={newEmployee.LastName} onChange={handleNewEmployeeInputChange} className={formErrors.LastName ? 'error' : ''}/>{formErrors.LastName && <span className="error-message">{formErrors.LastName}</span>}</div>
                        <div className="input-group"><label htmlFor="add-phone">Phone *</label><input id="add-phone" name="Phone" type="tel" placeholder="+1 555-123-4567" value={newEmployee.Phone} onChange={handleNewEmployeeInputChange} className={formErrors.Phone ? 'error' : ''}/>{formErrors.Phone && <span className="error-message">{formErrors.Phone}</span>}</div>
                        <div className="input-group"><label htmlFor="add-email">Email</label><input id="add-email" name="Email" type="email" placeholder="john.doe@example.com" value={newEmployee.Email} onChange={handleNewEmployeeInputChange} className={formErrors.Email ? 'error' : ''}/>{formErrors.Email && <span className="error-message">{formErrors.Email}</span>}</div>
                        <div className="input-group"><label htmlFor="add-dept">Department *</label><select id="add-dept" name="DeptID" value={newEmployee.DeptID} onChange={handleNewEmployeeInputChange} className={formErrors.DeptID ? 'error' : ''}><option value="">Select Department</option>{departments.map(dept => (<option key={dept.DeptID} value={dept.DeptID}>{dept.DeptName}</option>))}</select>{formErrors.DeptID && <span className="error-message">{formErrors.DeptID}</span>}</div>
                        <div className="input-group"><label htmlFor="add-pay">Hourly Pay ($) *</label><input id="add-pay" name="hourly_pay" type="number" step="0.01" min="0" placeholder="0.00" value={newEmployee.hourly_pay} onChange={handleNewEmployeeInputChange} className={formErrors.hourly_pay ? 'error' : ''}/>{formErrors.hourly_pay && <span className="error-message">{formErrors.hourly_pay}</span>}</div>
                        <div className="input-group"><label htmlFor="add-role">Role *</label><select id="add-role" name="Role" value={newEmployee.Role} onChange={handleNewEmployeeInputChange} className={formErrors.Role ? 'error' : ''}><option value="">Select Role</option><option value="Receptionist">Receptionist</option><option value="Housekeeping">Housekeeping</option><option value="Staff">Staff</option><option value="Contractor">Contractor</option></select>{formErrors.Role && <span className="error-message">{formErrors.Role}</span>}</div>
                        <div className="input-group"><label htmlFor="add-hired">Hire Date</label><input id="add-hired" name="HiredDate" type="date" value={newEmployee.HiredDate} onChange={handleNewEmployeeInputChange} max={formatDate(new Date())}/></div>
                        <div className="input-group"><label htmlFor="add-status">Status</label><select id="add-status" name="working_status" value={newEmployee.working_status} onChange={handleNewEmployeeInputChange}><option value="Working">Working</option><option value="Inactive">Inactive</option></select></div>
                        <div className="input-group"><label htmlFor="add-city">City</label><input id="add-city" name="city" type="text" placeholder="City" value={newEmployee.Address?.city || ''} onChange={handleNewEmployeeInputChange}/></div>
                        <div className="input-group"><label htmlFor="add-state">State</label><input id="add-state" name="state" type="text" placeholder="State" value={newEmployee.Address?.state || ''} onChange={handleNewEmployeeInputChange}/></div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="action-button muted" onClick={handleCancelAdd} disabled={isSaving}> <FiXCircle/> Cancel </button>
                        <button type="submit" className="action-button success" disabled={isSaving}> <FiUserCheck/> {isSaving ? 'Saving...' : 'Save Employee'} </button>
                    </div>
                 </form>
            </div>
        </div>
    );

     const renderFilterModal = () => (
         <div className="popup-overlay" onClick={() => setShowFilterModal(false)}>
             <div className="modal-content filter-modal-content" onClick={(e) => e.stopPropagation()}>
                 <div className="modal-header">
                     <h3><FiFilter/> Filter Employees</h3>
                     <button className="modal-close-button" onClick={() => setShowFilterModal(false)} title="Close"> <FiX/> </button>
                 </div>
                 <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
                     <div className="form-grid">
                         <div className="input-group"><label htmlFor="filter-FullName">Name:</label><input id="filter-FullName" type="text" name="FullName" value={filters.FullName} onChange={handleFilterChange} placeholder="Filter by name..."/></div>
                         <div className="input-group"><label htmlFor="filter-Phone">Phone:</label><input id="filter-Phone" type="tel" name="Phone" value={filters.Phone} onChange={handleFilterChange} placeholder="Filter by phone..."/></div>
                         <div className="input-group"><label htmlFor="filter-Email">Email:</label><input id="filter-Email" type="email" name="Email" value={filters.Email} onChange={handleFilterChange} placeholder="Filter by email..."/></div>
                         <div className="input-group"><label htmlFor="filter-Role">Role:</label><input id="filter-Role" type="text" name="Role" value={filters.Role} onChange={handleFilterChange} placeholder="Filter by role..."/></div>
                         <div className="input-group"><label htmlFor="filter-DeptID">Department:</label><select id="filter-DeptID" name="DeptID" value={filters.DeptID} onChange={handleFilterChange}><option value="">All Departments</option>{departments.map(d => (<option key={d.DeptID} value={d.DeptID}>{d.DeptName}</option>))}</select></div>
                         <div className="input-group"><label htmlFor="filter-Status">Status:</label><select id="filter-Status" name="Status" value={filters.Status} onChange={handleFilterChange}><option value="">All Statuses</option><option value="Working">Working</option><option value="Inactive">Inactive</option><option value="Not Working">Not Working</option></select></div>
                     </div>
                     <div className="modal-actions">
                          <button type="button" className="action-button muted" onClick={clearFilters}> Clear </button>
                          <button type="submit" className="action-button primary"> Apply Filters </button>
                     </div>
                 </form>
             </div>
         </div>
     );

     const renderConfirmationModal = () => (
         <div className="popup-overlay" onClick={() => setShowConfirmation(false)}>
             <div className="modal-content confirmation-popup-content" onClick={(e) => e.stopPropagation()}>
                 <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none'}}>
                    <h3><FiAlertTriangle style={{ color: 'var(--danger-color)' }}/> Confirm Deactivation</h3>
                 </div>
                 <p>Are you sure you want to set employee <strong>{employeeToRemove?.FullName}</strong> as Inactive? They may lose system access.</p>
                 <div className="modal-actions">
                     <button className="action-button muted" onClick={() => setShowConfirmation(false)} disabled={isDeleting}> <FiXCircle/> Cancel </button>
                     <button className="action-button danger" onClick={handleRemoveEmployee} disabled={isDeleting}> <FiTrash2/> {isDeleting ? 'Deactivating...' : 'Yes, Deactivate'} </button>
                 </div>
             </div>
         </div>
     );

    // --- Main JSX Return ---
    return (
        <div className="employee-container">
            <Navbar />
            <div className="content-wrapper">
                <div className="header-section">
                    <h1><FiUsers/> Employee Management</h1>
                    <div className="header-actions">
                        <button className="action-button secondary" onClick={() => setShowFilterModal(true)}> <FiFilter/> Filter </button>
                        <button className="action-button primary" onClick={handleShowAddForm}> <FiPlus/> Add Employee </button>
                    </div>
                </div>

                {/* Optional: Stats Section */}
                <section className="stats-section">
                     <div className="stat-card-mini">
                         <FiUsers className="stat-icon-mini" style={{color: 'var(--primary-color)'}}/>
                         <div className="stat-info"><h4>Total Employees</h4><p>{isLoading ? '-' : employees.length}</p></div>
                     </div>
                     <div className="stat-card-mini">
                         <FiBriefcase className="stat-icon-mini" style={{color: 'var(--secondary-color)'}}/>
                         <div className="stat-info"><h4>Departments</h4><p>{isLoading ? '-' : departments.length}</p></div>
                     </div>
                     {/* Add more relevant stats if needed */}
                 </section>

                {/* Display error message if exists */}
                {error && !isLoading && renderError()}

                {/* Employee Table */}
                <div className="table-container">
                    {isLoading ? renderLoading() : (employees.length > 0 ? renderTableContent() : !error && renderNoData())}
                </div>

                {/* Modals */}
                {showAddFormModal && newEmployee && renderAddForm()}
                {showFilterModal && renderFilterModal()}
                {showConfirmation && employeeToRemove && renderConfirmationModal()}

            </div>
        </div>
    );
};

export default Employee;

// --- END OF FILE Employee.js ---