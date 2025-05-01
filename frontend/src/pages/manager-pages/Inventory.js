// --- START OF FILE Inventory.js ---

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Axios from "axios";
import Navbar from "../../components/Navbar";
import "./Inventory.css"; // Import themed CSS
import {
    FiPackage, FiRefreshCw, FiSearch, FiPlusCircle, FiShoppingCart, FiEdit2, FiTrash2,
    FiAlertTriangle, FiInfo, FiList, FiDollarSign, FiHash, FiTag, FiBox, FiX, FiSave, FiXCircle, FiSliders // Icons
} from "react-icons/fi";

const Inventory = () => {
  const hotelID = localStorage.getItem("hotelID");

  // --- State ---
  const [inventory, setInventory] = useState([]);
  const [order, setOrder] = useState({ itemName: "", quantity: "1", unitPrice: "0" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false); // Loading state for order placement
  const [isAddingItem, setIsAddingItem] = useState(false); // Loading state for adding new item
  const [error, setError] = useState(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ // State for the Add Item form
    itemName: "", category: "", unit: "", threshold: "10" // Default threshold
  });
  const [formErrors, setFormErrors] = useState({}); // Errors for Add Item form

  // --- Data Fetching ---
  const fetchInventory = useCallback(async (showLoader = true) => {
    if (!hotelID) {
      setError("Hotel ID missing. Please login again.");
      setIsLoading(false);
      return;
    }
    if (showLoader) setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      const response = await Axios.get(`http://localhost:3001/inventory/${hotelID}`);
      setInventory(response.data || []); // Ensure it's an array
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setError("Failed to fetch inventory data. Please check connection or try refreshing.");
      setInventory([]); // Clear data on error
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [hotelID]); // Dependency on hotelID

  useEffect(() => {
    fetchInventory(); // Initial fetch
  }, [fetchInventory]); // Correct dependency

  // --- Form Handling ---
  const handleOrderInputChange = (e) => {
    const { name, value } = e.target;
    // Allow only numbers (int/float) for quantity and price
    if (name === "quantity" || name === "unitPrice") {
      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setOrder(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setOrder(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNewItemInputChange = (e) => {
      const { name, value } = e.target;
       // Allow only numbers (integer) for threshold
       if (name === "threshold") {
            if (value === "" || /^[0-9]*$/.test(value)) {
                 setNewItem(prev => ({ ...prev, [name]: value }));
            }
       } else {
            setNewItem(prev => ({ ...prev, [name]: value }));
       }
  };

  // --- Actions ---
  const orderItem = async (e) => {
    e.preventDefault();
    setIsOrdering(true); // Start loading

    try {
      const quantity = parseFloat(order.quantity);
      const unitPrice = parseFloat(order.unitPrice);
      const itemName = order.itemName.trim();

      // --- Basic Validation ---
      if (!itemName) { alert("Item Name is required."); setIsOrdering(false); return; }
      if (isNaN(quantity) || quantity <= 0) { alert("Quantity must be a positive number."); setIsOrdering(false); return; }
      if (isNaN(unitPrice) || unitPrice < 0) { alert("Unit price must be a non-negative number."); setIsOrdering(false); return; }
      // --- End Validation ---

      let inventoryID;
      const existingItem = inventory.find(item => item.ItemName.toLowerCase() === itemName.toLowerCase());

      if (!existingItem) {
         // Alert user or automatically add? For now, let's require adding first
         alert(`Item "${itemName}" not found in inventory. Please add it first using the 'Add New Item' button.`);
         setIsOrdering(false);
         return;
         // // --- Alternative: Auto-add item if not found (less control) ---
         // console.log(`Item "${itemName}" not found. Adding it automatically.`);
         // const addResponse = await Axios.post("http://localhost:3001/add-item", {
         //   hotelID,
         //   itemName: itemName,
         //   // Default values for category, unit, threshold needed here
         //   category: 'Uncategorized',
         //   unit: 'Unit',
         //   lowStockThreshold: 10
         // });
         // inventoryID = addResponse.data.InventoryID;
      } else {
        inventoryID = existingItem.InventoryID;
      }

      // --- Place the order via API ---
      await Axios.post("http://localhost:3001/order-item", {
        hotelID, inventoryID, quantity, unitPrice,
      });

      setOrder({ itemName: "", quantity: "1", unitPrice: "0" }); // Reset form
      await fetchInventory(false); // Refresh inventory list without full loader
      // Use a better notification than alert
      console.log("Order placed successfully!"); // Replace with toast later
    } catch (error) {
      console.error("Error processing order:", error);
      const errMsg = error.response?.data?.message || "Failed to process order. Please try again.";
      setError(errMsg); // Show error message in UI
    } finally {
      setIsOrdering(false); // Stop loading
    }
  };

  const validateNewItemForm = () => {
      const errors = {};
      if (!newItem.itemName.trim()) errors.itemName = "Item name is required.";
      if (newItem.threshold && (isNaN(parseInt(newItem.threshold)) || parseInt(newItem.threshold) < 0)) {
           errors.threshold = "Threshold must be a non-negative whole number.";
      }
      // Add validation for category, unit if they become required
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const handleAddNewItem = async (e) => {
      e.preventDefault();
      if (!validateNewItemForm()) return;

      setIsAddingItem(true);
      try {
           const dataToSend = {
                hotelID,
                itemName: newItem.itemName.trim(),
                category: newItem.category.trim() || null, // Send null if empty
                unit: newItem.unit.trim() || null, // Send null if empty
                lowStockThreshold: parseInt(newItem.threshold) || 10, // Default or parsed value
           };

           await Axios.post("http://localhost:3001/add-item", dataToSend);

           setShowAddItemModal(false); // Close modal on success
           setNewItem({ itemName: "", category: "", unit: "", threshold: "10" }); // Reset form
           await fetchInventory(false); // Refresh list
           console.log("New item added successfully!"); // Replace with toast
      } catch (error) {
           console.error("Error adding new item:", error);
           const errMsg = error.response?.data?.message || "Failed to add item. Check if it already exists.";
           // Display error within the modal?
           setFormErrors({ general: errMsg }); // Example: general error message
      } finally {
           setIsAddingItem(false);
      }
  };

  // --- Filtering & Formatting ---
  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    return inventory.filter(item =>
        item.ItemName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleString(undefined, { // Use localeString for date and time
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true // Example format
        });
    } catch (e) { return 'Invalid Date'; }
  };

  // --- KPIs Calculation (Example) ---
  const kpiValues = useMemo(() => {
      const totalItems = inventory.length;
      const lowStockItems = inventory.filter(item => item.Quantity < (item.LowStockThreshold || 10)).length; // Use threshold or default
      // Value calculation needs price data per item - assuming it's NOT available for this example
      const estimatedValue = 'N/A'; // Placeholder

      return { totalItems, lowStockItems, estimatedValue };
  }, [inventory]);

  // --- Render Logic ---
  const renderLoading = () => (
      <div className="loading-spinner">
           <div className="spinner"></div>
           <p>Loading Inventory...</p>
      </div>
  );

  const renderError = () => (
       <div className="error-message-container">
          <div className="error-message">
               <span className="error-icon"><FiAlertTriangle/></span>
               <p>{error}</p>
               <button onClick={() => fetchInventory()} className="refresh-btn" style={{padding: '0.5rem 1rem', fontSize: '0.8rem'}}>Retry</button>
          </div>
       </div>
  );

  const renderTable = () => (
     <div className="table-container">
         <table className="inventory-table">
             <thead>
                 <tr>
                     <th>ID</th>
                     <th>Item Name</th>
                     <th>Category</th> {/* New Column */}
                     <th>Quantity</th>
                     <th>Unit</th> {/* New Column */}
                     <th>Threshold</th> {/* New Column */}
                     <th>Last Updated</th>
                     <th>Actions</th> {/* New Column */}
                 </tr>
             </thead>
             <tbody>
                 {filteredInventory.length > 0 ? (
                     filteredInventory.map(item => (
                         <tr key={item.InventoryID}>
                             <td className="id-cell">{item.InventoryID}</td>
                             <td className="name-cell">{item.ItemName}</td>
                             <td>{item.Category || '-'}</td> {/* Display Category */}
                             <td className={`quantity-cell ${item.Quantity < (item.LowStockThreshold || 10) ? 'low-stock' : ''}`}>
                                 {item.Quantity}
                                 {item.Quantity < (item.LowStockThreshold || 10) && <FiAlertTriangle title="Low Stock" style={{marginLeft: '5px', color: 'var(--warning-color)'}}/>}
                             </td>
                             <td>{item.Unit || '-'}</td> {/* Display Unit */}
                             <td>{item.LowStockThreshold ?? '10'}</td> {/* Display Threshold */}
                             <td className="date-cell">{formatDate(item.LastUpdated)}</td>
                              <td>
                                   <div className="action-buttons">
                                        {/* Placeholder Buttons - Implement onClick handlers */}
                                        <button className="edit-btn action-button" title="Edit Item (Not Implemented)"> <FiEdit2/> </button>
                                        <button className="adjust-btn action-button" title="Adjust Stock (Not Implemented)"> <FiSliders/> </button>
                                        {/* <button className="remove-button action-button" title="Delete Item (Not Implemented)"> <FiTrash2/> </button> */}
                                   </div>
                              </td>
                         </tr>
                     ))
                 ) : (
                     <tr>
                         <td colSpan="8" className="no-items"> {/* Adjusted colSpan */}
                             {searchTerm ? "No matching items found" : "Inventory is empty. Add items using the button above."}
                         </td>
                     </tr>
                 )}
             </tbody>
         </table>
     </div>
  );

  const renderAddItemModal = () => (
       <div className="popup-overlay" onClick={() => setShowAddItemModal(false)}>
           <div className="add-item-modal" onClick={(e) => e.stopPropagation()}>
               <div className="modal-header">
                   <h3><FiPlusCircle/> Add New Inventory Item</h3>
                   <button className="close-button" onClick={() => setShowAddItemModal(false)} title="Close"> <FiX/> </button>
               </div>
               <form onSubmit={handleAddNewItem}>
                   {formErrors.general && <p className="error-message" style={{textAlign: 'center'}}>{formErrors.general}</p>}
                   <div className="form-grid">
                       <div className="input-group">
                           <label htmlFor="newItemName">Item Name *</label>
                           <input id="newItemName" type="text" name="itemName" placeholder="e.g., Pillow Cases" value={newItem.itemName} onChange={handleNewItemInputChange} className={formErrors.itemName ? 'error' : ''} required />
                           {formErrors.itemName && <span className="error-message">{formErrors.itemName}</span>}
                       </div>
                       <div className="input-group">
                           <label htmlFor="newItemCategory">Category</label>
                           <input id="newItemCategory" type="text" name="category" placeholder="e.g., Linen, Cleaning Supplies" value={newItem.category} onChange={handleNewItemInputChange} />
                           {/* Optional: Convert to select if categories are predefined */}
                       </div>
                       <div className="input-group">
                           <label htmlFor="newItemUnit">Unit</label>
                           <input id="newItemUnit" type="text" name="unit" placeholder="e.g., pcs, kg, liter" value={newItem.unit} onChange={handleNewItemInputChange} />
                       </div>
                       <div className="input-group">
                           <label htmlFor="newItemThreshold">Low Stock Threshold</label>
                           <input id="newItemThreshold" type="text" inputMode="numeric" pattern="[0-9]*" name="threshold" placeholder="e.g., 10" value={newItem.threshold} onChange={handleNewItemInputChange} className={formErrors.threshold ? 'error' : ''} />
                           {formErrors.threshold && <span className="error-message">{formErrors.threshold}</span>}
                       </div>
                   </div>
                   <div className="modal-actions">
                        <button type="button" className="cancel-button" onClick={() => setShowAddItemModal(false)} disabled={isAddingItem}> <FiXCircle/> Cancel </button>
                        <button type="submit" className="save-button" disabled={isAddingItem}> <FiSave/> {isAddingItem ? 'Adding...' : 'Add Item'} </button>
                   </div>
               </form>
           </div>
       </div>
  );

  return (
      <div className="inventory-app">
        <Navbar />
        <div className="inventory-container">
          <header className="inventory-header">
            <h1><FiPackage style={{marginRight: '10px'}}/> Inventory Management</h1>
            <div className="header-actions">
               <div className="search-box">
                  <input type="text" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <i className="search-icon"><FiSearch/></i>
               </div>
               <button onClick={() => setShowAddItemModal(true)} className="add-item-btn"> <FiPlusCircle/> Add New Item </button>
               <button onClick={() => fetchInventory()} className="refresh-btn" disabled={isLoading}> <FiRefreshCw className={isLoading ? 'spin-animation' : ''}/> {isLoading ? "Refreshing" : "Refresh"} </button> {/* Add spin class if desired */}
            </div>
          </header>

          {/* KPI Section */}
          <section className="kpi-section">
               <div className="kpi-card">
                    <span className="kpi-icon total-items"><FiList/></span>
                    <div className="kpi-info"><h3>Total Items</h3><p>{isLoading ? '-' : kpiValues.totalItems}</p></div>
               </div>
               <div className="kpi-card">
                    <span className="kpi-icon low-stock"><FiAlertTriangle/></span>
                    <div className="kpi-info"><h3>Low Stock</h3><p>{isLoading ? '-' : kpiValues.lowStockItems}</p></div>
               </div>
                <div className="kpi-card">
                     <span className="kpi-icon total-value"><FiDollarSign/></span>
                     <div className="kpi-info"><h3>Estimated Value</h3><p>{isLoading ? '-' : kpiValues.estimatedValue}</p></div>
                </div>
          </section>

          <div className="inventory-content">
            {/* Inventory List Section */}
            <section className="inventory-list-section">
              <div className="section-header">
                <h2><span className="header-icon"><FiBox/></span>Current Inventory</h2>
                {!isLoading && <span className="item-count">{filteredInventory.length} items</span>}
              </div>
              {isLoading ? renderLoading() : error ? renderError() : renderTable()}
            </section>

            {/* Order Form Section */}
            <section className="order-section">
              <div className="section-header">
                 <h2><span className="header-icon"><FiShoppingCart/></span>Place New Order</h2>
              </div>
              <form onSubmit={orderItem} className="order-form">
                 {/* General error display for ordering */}
                 {error && !isLoading && <p className="error-message" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Error: {error}</p>}
                <div className="form-group">
                  <label htmlFor="itemName">Item Name (Must Exist)</label>
                  <input id="itemName" type="text" name="itemName" placeholder="Enter existing item name" value={order.itemName} onChange={handleOrderInputChange} required list="inventoryItems" />
                   {/* Datalist for suggestions */}
                   <datalist id="inventoryItems">
                        {inventory.map(item => <option key={item.InventoryID} value={item.ItemName} />)}
                   </datalist>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="quantity">Quantity *</label>
                    <input id="quantity" type="text" inputMode="decimal" name="quantity" placeholder="1" value={order.quantity} onChange={handleOrderInputChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="unitPrice">Unit Price ($) *</label>
                    <input id="unitPrice" type="text" inputMode="decimal" name="unitPrice" placeholder="0.00" value={order.unitPrice} onChange={handleOrderInputChange} required />
                  </div>
                </div>
                <button type="submit" className="submit-order-btn" disabled={isOrdering}>
                  {isOrdering ? 'Placing Order...' : <><FiShoppingCart/> Place Order</>}
                </button>
              </form>
            </section>
          </div>

          {/* Add Item Modal */}
          {showAddItemModal && renderAddItemModal()}

        </div>
      </div>
  );
};

export default Inventory;

// --- END OF FILE Inventory.js ---