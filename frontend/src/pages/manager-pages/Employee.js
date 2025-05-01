// --- START OF FILE Employee.js ---

import React, { useState, useEffect, useMemo } from "react";
import Axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    flexRender,
} from '@tanstack/react-table';
import Navbar from "../../components/Navbar";
import "./Employee.css"; // Import updated CSS
import {
    FiPlus, FiFilter, FiEdit2, FiSave, FiXCircle, FiTrash2, FiAlertTriangle, FiUserCheck, FiChevronLeft, FiChevronRight, FiX // Icons
} from "react-icons/fi";

const Employee = () => {
    const navigate = useNavigate();
    const hotelID = localStorage.getItem("hotelID");

    // --- State ---
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false); // Control visibility of add form
    const [newEmployee, setNewEmployee] = useState(null); // Store data for new employee
    const [formErrors, setFormErrors] = useState({});
    const [editingEmployeeId, setEditingEmployeeId] = useState(null);
    const [originalEmployeeData, setOriginalEmployeeData] = useState(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        FullName: '', Phone: '', Email: '', Role: '', Status: ''
    });
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [employeeToRemove, setEmployeeToRemove] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Loading state for table
    const [error, setError] = useState(null); // Error state for fetching

    // --- Fetching Data ---
    const fetchEmployees = (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        setError(null);
        // Use applyFilters logic if filters are set, otherwise fetch all
        const filterActive = Object.values(filters).some(val => val !== '' && val !== null);
        const endpoint = filterActive ? "http://localhost:3001/filter-employees" : "http://localhost:3001/employees";
        const payload = filterActive ? { hotelID, ...filters } : { hotelID };

        Axios.post(endpoint, payload)
            .then((response) => {
                const enhancedData = (response.data || []).map(emp => ({
                    ...emp,
                    FullName: `${emp.FirstName} ${emp.LastName}`
                }));
                setEmployees(enhancedData);
            })
            .catch(err => {
                 console.error("Error fetching employees:", err);
                 setError("Failed to load employee data.");
                 setEmployees([]); // Clear data on error
            })
            .finally(() => {
                 if (showLoading) setIsLoading(false);
            });
    };

    const fetchDepartments = () => {
        Axios.post("http://localhost:3001/departments", { hotelID })
            .then(response => setDepartments(response.data || []))
            .catch(err => {
                console.error("Error fetching departments:", err);
                // Handle error appropriately, maybe show a message
            });
    };

    useEffect(() => {
         if (!hotelID) {
             setError("Hotel ID missing. Please log in.");
             setIsLoading(false);
             // navigate('/login');
             return;
         }
        fetchEmployees();
        fetchDepartments();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hotelID]); // Initial fetch depends on hotelID

    // --- Filter Logic ---
    const applyFilters = () => {
        setShowFilterModal(false); // Close modal first
        fetchEmployees(); // Fetch based on current filters state
    };

    const clearFilters = () => {
         setFilters({ FullName: '', Phone: '', Email: '', Role: '', Status: '' });
         // Need to trigger refetch after clearing state
         // Option 1: Fetch immediately (might feel slow if typing)
         // fetchEmployees();
         // Option 2: Let applyFilters handle fetch (requires user click)
         // Or fetch after state is confirmed updated:
         setTimeout(() => fetchEmployees(), 0);
         setShowFilterModal(false);
    };

    // --- Inline Edit Logic ---
    const handleEditChange = (empID, field, value) => {
        // Role validation
        if (field === "Role" && value.toLowerCase() === "manager") {
            alert("Role cannot be set to 'Manager' via this interface.");
            // Revert the change visually (optional, depends on UX preference)
            // setEmployees(prev => prev.map(emp => emp.EmpID === empID ? { ...originalEmployeeData } : emp));
            return;
        }
         // Normalize Role value
         if (field === "Role") {
             value = value.trim(); // Remove extra spaces
         }
         // Update local state for visual feedback
        setEmployees(prev =>
            prev.map(emp =>
                emp.EmpID === empID ? { ...emp, [field]: value } : emp
            )
        );
    };

    const handleCancelEdit = () => {
        // Revert changes from original data if available
        if (originalEmployeeData) {
            setEmployees(prev =>
                prev.map(emp =>
                    emp.EmpID === originalEmployeeData.EmpID ? { ...originalEmployeeData } : emp
                )
            );
        }
        setEditingEmployeeId(null);
        setOriginalEmployeeData(null);
    };

    const handleUpdate = (employee) => {
         // Basic validation before sending (example: check hourly pay)
         const pay = parseFloat(employee.hourly_pay);
         if (isNaN(pay) || pay < 0) {
             alert("Invalid Hourly Pay value.");
             return;
         }

         // Prepare data for backend
        const updatedData = {
            empID: employee.EmpID,
            // Split FullName carefully, handling potential missing last names
            firstName: employee.FullName.split(" ")[0] || '',
            lastName: employee.FullName.split(" ").slice(1).join(" ") || '',
            phone: employee.Phone,
            email: employee.Email,
            deptName: employee.DeptName, // Assuming backend maps DeptName to DeptID if needed
            hourlyPay: pay,
            role: employee.Role,
            workingStatus: employee.working_status,
             // Format HiredDate correctly if it was edited as text/date input
             hiredDate: typeof employee.HiredDate === 'string' ? employee.HiredDate : new Date(employee.HiredDate).toISOString().split("T")[0],
            hotelID: hotelID,
        };

        Axios.post("http://localhost:3001/update-employee", updatedData)
            .then(() => {
                alert("Employee updated successfully."); // Use better notification
                setEditingEmployeeId(null);
                setOriginalEmployeeData(null);
                fetchEmployees(false); // Refresh without full loading
            })
            .catch((err) => {
                console.error("Update failed:", err);
                alert("Failed to update employee."); // Use better notification
                // Optionally revert changes on failure
                // handleCancelEdit();
            });
    };

    // --- Add Employee Logic ---
    const handleShowAddForm = () => {
        setNewEmployee({ // Initialize with default/empty values
            FirstName: '', LastName: '', Phone: '', Email: '', DeptID: '',
            hourly_pay: '', Role: '', working_status: 'Working',
            HiredDate: formatDate(new Date()), // Default hire date to today
            Address: { city: '', state: '' }
        });
        setFormErrors({});
        setShowAddForm(true); // Show the form section
    };

    const handleCancelAdd = () => {
        setNewEmployee(null);
        setFormErrors({});
        setShowAddForm(false); // Hide the form section
    };

    const validateForm = () => {
        const errors = {};
        if (!newEmployee.FirstName.trim()) errors.FirstName = "First name is required";
        if (!newEmployee.LastName.trim()) errors.LastName = "Last name is required";
        if (!newEmployee.Phone.trim()) errors.Phone = "Phone is required";
         // Basic email format check (can be more robust)
         if (newEmployee.Email && !/\S+@\S+\.\S+/.test(newEmployee.Email)) errors.Email = "Invalid email format";
        if (!newEmployee.DeptID) errors.DeptID = "Department is required";
        if (!newEmployee.hourly_pay || isNaN(parseFloat(newEmployee.hourly_pay)) || parseFloat(newEmployee.hourly_pay) < 0) errors.hourly_pay = "Valid hourly pay is required";
        if (!newEmployee.Role) errors.Role = "Role is required";
         if (newEmployee.Role.toLowerCase() === 'manager') {
             errors.Role = "Manager role cannot be assigned here."; // Prevent adding Manager role
         }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveNewEmployee = () => {
        if (!validateForm()) return;

         // Prepare data for backend
         const dataToSend = {
            hotelID: hotelID,
            deptID: newEmployee.DeptID,
            firstName: newEmployee.FirstName.trim(),
            lastName: newEmployee.LastName.trim(),
            phone: newEmployee.Phone.trim(),
            email: newEmployee.Email.trim(),
            hourlyPay: parseFloat(newEmployee.hourly_pay),
            workingStatus: newEmployee.working_status,
            role: newEmployee.Role, // Already validated not 'manager'
            hiredDate: newEmployee.HiredDate,
            // Convert address object to JSON string if backend expects it
            address: (newEmployee.Address?.city || newEmployee.Address?.state)
                     ? JSON.stringify(newEmployee.Address)
                     : null
         };

        Axios.post("http://localhost:3001/add-employee", dataToSend)
            .then(() => {
                alert("Employee added successfully!"); // Use better notification
                fetchEmployees(false); // Refresh table
                handleCancelAdd(); // Close form
            })
            .catch(err => {
                console.error("Error adding employee:", err);
                const errMsg = err.response?.data?.message || "Failed to add employee. Please check the form values.";
                alert(`Error: ${errMsg}`); // Show error
                // Keep form open for corrections
            });
    };

    // --- Remove Employee Logic ---
    const confirmRemoveEmployee = (employee) => {
        setEmployeeToRemove(employee);
        setShowConfirmation(true);
    };

    const removeEmployee = () => {
        if (!employeeToRemove) return;

        Axios.post("http://localhost:3001/remove-employee", { empID: employeeToRemove.EmpID })
            .then(() => {
                alert("Employee removed successfully."); // Use better notification
                fetchEmployees(false); // Refresh list
            })
            .catch((error) => {
                console.error("Error removing employee:", error);
                alert("Failed to remove employee."); // Use better notification
            })
            .finally(() => {
                setShowConfirmation(false);
                setEmployeeToRemove(null);
            });
    };

    // --- Table Columns Definition ---
    const columns = useMemo(() => [
        // Use flexRender for headers and cells
         { accessorKey: 'FullName', header: 'Full Name', size: 200 },
         { accessorKey: 'DeptName', header: 'Department', size: 150 },
         { accessorKey: 'Phone', header: 'Phone', size: 150 },
         { accessorKey: 'Email', header: 'Email', size: 220 },
         { accessorKey: 'hourly_pay', header: 'Hourly Pay', cell: info => `$${parseFloat(info.getValue() || 0).toFixed(2)}`, size: 110 },
         { accessorKey: 'Role', header: 'Role', size: 130 },
         { accessorKey: 'HiredDate', header: 'Hired Date', cell: info => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'N/A', size: 120 },
         { accessorKey: 'working_status', header: 'Status', cell: info => (
             <span className={`status-badge ${info.getValue()?.toLowerCase().replace(' ','.') || 'unknown'}`}>
                 {info.getValue()}
             </span>
         ), size: 110 },
         { id: 'actions', header: 'Actions', size: 200, cell: ({ row }) => { // Combined actions cell
             const isEditing = row.original.EmpID === editingEmployeeId;
             return (
                 <div className="action-buttons">
                     {isEditing ? (
                         <>
                             <button className="save-button" onClick={() => handleUpdate(row.original)} title="Save Changes"> <FiSave/> </button>
                             <button className="cancel-button" onClick={handleCancelEdit} title="Cancel Edit"> <FiXCircle/> </button>
                         </>
                     ) : (
                         <>
                             <button className="update-button" onClick={() => { setOriginalEmployeeData({ ...row.original }); setEditingEmployeeId(row.original.EmpID); }} title="Edit Employee"> <FiEdit2/> </button>
                             <button className="remove-button" onClick={() => confirmRemoveEmployee(row.original)} title="Remove Employee"> <FiTrash2/> </button>
                         </>
                     )}
                 </div>
             );
         }},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [editingEmployeeId, departments]); // Re-render columns if editing state or departments change


    // --- React Table Instance ---
    const table = useReactTable({
        data: employees,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 8 } }, // Adjust page size
        // Enable row selection if needed
        // enableRowSelection: true,
        // onRowSelectionChange: setRowSelection, // Example state setter
        // state: { rowSelection }, // Example state
    });

    // --- Render Helper ---
    const renderTableContent = () => {
        if (isLoading) {
            return <div className="loading-indicator"><div className="spinner"></div><p>Loading Employees...</p></div>;
        }
        if (error) {
             return <div className="error-message"><FiAlertTriangle size={24}/><p>{error}</p></div>;
        }
         if (employees.length === 0) {
             return <div className="no-data-message" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No employees found matching criteria.</div>;
        }

        return (
            <>
                <table className="employee-table">
                    <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th key={header.id} style={{ width: `${header.getSize()}px` }}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map(row => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id}>
                                        {renderCellContent(cell, row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Pagination */}
                <div className="pagination-controls">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}> <FiChevronLeft/> Previous </button>
                    <span> Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} </span>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}> Next <FiChevronRight/> </button>
                </div>
            </>
        );
    };

    // Helper to render cell content with editing inputs
    const renderCellContent = (cell, row) => {
        const isEditing = row.original.EmpID === editingEmployeeId;
        const columnId = cell.column.id;
        const value = row.original[columnId]; // Use original value for inputs

        if (isEditing && ['FullName', 'Phone', 'Email', 'hourly_pay', 'Role', 'HiredDate'].includes(columnId)) {
            const inputType = columnId === 'hourly_pay' ? 'number' : columnId === 'HiredDate' ? 'date' : 'text';
            return (
                <input
                    type={inputType}
                    step={inputType === 'number' ? '0.01' : undefined}
                     // Format date for input type="date"
                    value={inputType === 'date' ? (value ? formatDate(new Date(value)) : '') : value || ''}
                    onChange={(e) => handleEditChange(row.original.EmpID, columnId, e.target.value)}
                     // Add min/max for date/number if needed
                     max={inputType === 'date' ? formatDate(new Date()) : undefined}
                />
            );
        }
         if (isEditing && columnId === 'DeptName') {
            return (
                <select value={value} onChange={(e) => handleEditChange(row.original.EmpID, columnId, e.target.value)}>
                    {departments.map((d) => (<option key={d.DeptID} value={d.DeptName}>{d.DeptName}</option>))}
                </select>
            );
         }
        if (isEditing && columnId === 'working_status') {
             return (
                 <select value={value} onChange={(e) => handleEditChange(row.original.EmpID, columnId, e.target.value)}>
                     <option value="Working">Working</option>
                     <option value="Inactive">Inactive</option>
                     <option value="Not Working">Not Working</option> {/* Keep if used */}
                 </select>
             );
        }
        // Default rendering using flexRender
        return flexRender(cell.column.columnDef.cell, cell.getContext());
    };

    // --- JSX Return ---
    return (
        <div className="employee-container">
            <Navbar />
            <div className="content-wrapper">
                <div className="header-section">
                    <h1>Employee Management</h1>
                    <div> {/* Wrapper for buttons */}
                        <button className="filter-button" onClick={() => setShowFilterModal(true)}> <FiFilter/> Filter </button>
                        <button className="add-button" onClick={handleShowAddForm} style={{ marginLeft: '1rem' }}> <FiPlus/> Add Employee </button>
                    </div>
                </div>

                {/* Add Employee Form - Conditionally Rendered */}
                {showAddForm && newEmployee && (
                    <div className="add-employee-form">
                        <div className="form-header">
                            <h3>Add New Employee</h3>
                            <button className="close-button" onClick={handleCancelAdd} title="Close Form"> <FiX/> </button>
                        </div>
                        <div className="form-grid">
                             {/* Input fields using labels and error messages */}
                             {/* Example for First Name */}
                             <div className="input-group">
                                 <label htmlFor="add-firstName">First Name *</label>
                                 <input id="add-firstName" type="text" placeholder="John" value={newEmployee.FirstName} onChange={e => setNewEmployee({...newEmployee, FirstName: e.target.value})} className={formErrors.FirstName ? 'error' : ''}/>
                                 {formErrors.FirstName && <span className="error-message">{formErrors.FirstName}</span>}
                            </div>
                             {/* ... other input groups ... */}
                             <div className="input-group"><label htmlFor="add-lastName">Last Name *</label><input id="add-lastName" type="text" placeholder="Doe" value={newEmployee.LastName} onChange={e => setNewEmployee({...newEmployee, LastName: e.target.value})} className={formErrors.LastName ? 'error' : ''}/>{formErrors.LastName && <span className="error-message">{formErrors.LastName}</span>}</div>
                             <div className="input-group"><label htmlFor="add-phone">Phone *</label><input id="add-phone" type="tel" placeholder="+1 555-123-4567" value={newEmployee.Phone} onChange={e => setNewEmployee({...newEmployee, Phone: e.target.value})} className={formErrors.Phone ? 'error' : ''}/>{formErrors.Phone && <span className="error-message">{formErrors.Phone}</span>}</div>
                             <div className="input-group"><label htmlFor="add-email">Email</label><input id="add-email" type="email" placeholder="john.doe@example.com" value={newEmployee.Email} onChange={e => setNewEmployee({...newEmployee, Email: e.target.value})} className={formErrors.Email ? 'error' : ''}/>{formErrors.Email && <span className="error-message">{formErrors.Email}</span>}</div>
                             <div className="input-group"><label htmlFor="add-dept">Department *</label><select id="add-dept" value={newEmployee.DeptID} onChange={e => setNewEmployee({...newEmployee, DeptID: e.target.value})} className={formErrors.DeptID ? 'error' : ''}><option value="">Select Department</option>{departments.map(dept => (<option key={dept.DeptID} value={dept.DeptID}>{dept.DeptName}</option>))}</select>{formErrors.DeptID && <span className="error-message">{formErrors.DeptID}</span>}</div>
                             <div className="input-group"><label htmlFor="add-pay">Hourly Pay ($) *</label><input id="add-pay" type="number" step="0.01" min="0" placeholder="0.00" value={newEmployee.hourly_pay} onChange={e => setNewEmployee({...newEmployee, hourly_pay: e.target.value})} className={formErrors.hourly_pay ? 'error' : ''}/>{formErrors.hourly_pay && <span className="error-message">{formErrors.hourly_pay}</span>}</div>
                             <div className="input-group"><label htmlFor="add-role">Role *</label><select id="add-role" value={newEmployee.Role} onChange={e => setNewEmployee({...newEmployee, Role: e.target.value})} className={formErrors.Role ? 'error' : ''}><option value="">Select Role</option><option value="Receptionist">Receptionist</option><option value="Housekeeping">Housekeeping</option><option value="Staff">Staff</option><option value="Contractor">Contractor</option>{/* Removed Manager */}</select>{formErrors.Role && <span className="error-message">{formErrors.Role}</span>}</div>
                             <div className="input-group"><label htmlFor="add-hired">Hire Date</label><input id="add-hired" type="date" value={newEmployee.HiredDate} onChange={e => setNewEmployee({...newEmployee, HiredDate: e.target.value})} max={formatDate(new Date())}/></div>
                             <div className="input-group"><label htmlFor="add-status">Status</label><select id="add-status" value={newEmployee.working_status} onChange={e => setNewEmployee({...newEmployee, working_status: e.target.value})}><option value="Working">Working</option><option value="Inactive">Inactive</option></select></div>
                             {/* Address Fields */}
                             <div className="input-group"><label htmlFor="add-city">City</label><input id="add-city" type="text" placeholder="City" value={newEmployee.Address?.city || ''} onChange={e => setNewEmployee({...newEmployee, Address: { ...newEmployee.Address, city: e.target.value }})}/></div>
                             <div className="input-group"><label htmlFor="add-state">State</label><input id="add-state" type="text" placeholder="State" value={newEmployee.Address?.state || ''} onChange={e => setNewEmployee({...newEmployee, Address: { ...newEmployee.Address, state: e.target.value }})}/></div>
                        </div>
                        <div className="form-actions">
                            <button className="cancel-button" onClick={handleCancelAdd}> <FiXCircle/> Cancel </button>
                            <button className="save-button" onClick={handleSaveNewEmployee}> <FiUserCheck/> Save Employee </button>
                        </div>
                    </div>
                )}

                {/* Employee Table */}
                <div className="table-container">
                    {renderTableContent()}
                </div>

                {/* Confirmation Popup */}
                {showConfirmation && employeeToRemove && (
                    <div className="popup-overlay" onClick={() => setShowConfirmation(false)}>
                        <div className="confirmation-popup" onClick={(e) => e.stopPropagation()}>
                            <h3><FiAlertTriangle style={{ color: 'var(--danger-color)' }}/> Confirm Removal</h3>
                            <p>Are you sure you want to remove employee <strong>{employeeToRemove.FullName}</strong>? This action cannot be undone.</p>
                            <div className="confirmation-buttons">
                                <button className="cancel-button" onClick={() => setShowConfirmation(false)}> <FiXCircle/> Cancel </button>
                                <button className="confirm-button" onClick={removeEmployee}> <FiTrash2/> Yes, Remove </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Modal */}
                {showFilterModal && (
                    <div className="popup-overlay" onClick={() => setShowFilterModal(false)}>
                        <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
                            <h3><FiFilter/> Filter Employees</h3>
                             <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
                                 {/* Filter Inputs */}
                                 <div className="input-group"><label htmlFor="filter-FullName">Full Name:</label><input id="filter-FullName" type="text" value={filters.FullName} onChange={(e) => setFilters({ ...filters, FullName: e.target.value })} placeholder="Filter by name..."/></div>
                                 <div className="input-group"><label htmlFor="filter-Phone">Phone:</label><input id="filter-Phone" type="tel" value={filters.Phone} onChange={(e) => setFilters({ ...filters, Phone: e.target.value })} placeholder="Filter by phone..."/></div>
                                 <div className="input-group"><label htmlFor="filter-Email">Email:</label><input id="filter-Email" type="email" value={filters.Email} onChange={(e) => setFilters({ ...filters, Email: e.target.value })} placeholder="Filter by email..."/></div>
                                 <div className="input-group"><label htmlFor="filter-Role">Role:</label><input id="filter-Role" type="text" value={filters.Role} onChange={(e) => setFilters({ ...filters, Role: e.target.value })} placeholder="Filter by role..."/></div>
                                 <div className="input-group"><label htmlFor="filter-Status">Status:</label><select id="filter-Status" value={filters.Status} onChange={(e) => setFilters({ ...filters, Status: e.target.value })}><option value="">All</option><option value="Working">Working</option><option value="Inactive">Inactive</option><option value="Not Working">Not Working</option></select></div>

                                 <div className="filter-actions">
                                      <button type="button" className="cancel-button" onClick={clearFilters}> Clear </button>
                                      <button type="submit" className="confirm-button"> Apply </button> {/* Reuse confirm style */}
                                 </div>
                             </form>
                         </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Employee;

// --- END OF FILE Employee.js ---