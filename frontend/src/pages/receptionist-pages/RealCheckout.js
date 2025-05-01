// --- START OF FILE RealCheckout.js ---

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Axios from "axios";
import "./RealCheckout.css"; // Ensure correct import
import BillingPopup from "../../components/BillingPopup"; // Assuming this is styled separately or uses global styles
import Navbar from "../../components/Navbar.js";
import { FiFilter, FiUsers, FiCalendar, FiCreditCard, FiInfo } from "react-icons/fi"; // Import icons

// Renaming component to avoid conflict if CurrentGuests is used elsewhere
const GuestsCheckingOut = () => {
    const dummyHID = localStorage.getItem("hotelID");
    const navigate = useNavigate();

    const [guests, setGuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showBillingPopup, setShowBillingPopup] = useState(false);
    const [showExtendPopup, setShowExtendPopup] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [newCheckoutDate, setNewCheckoutDate] = useState("");
    const [minCheckoutDate, setMinCheckoutDate] = useState(""); // Corrected state name
    const [isExtending, setIsExtending] = useState(false); // For extend button loading state

    const [filters, setFilters] = useState({
        FirstName: "",
        LastName: "",
        EmailAddress: "",
        PhoneNumber: "",
        NID: "",
        DateOfBirth: "",
    });

    // --- Helper: Format Date for Display ---
    const formatDateForDisplay = useCallback((dateString) => {
        if (!dateString) return "N/A";
        try {
            // Assuming dateString is like 'YYYY-MM-DDTHH:mm:ss.sssZ' or 'YYYY-MM-DD'
            const date = new Date(dateString);
             if (isNaN(date.getTime())) return "Invalid Date";
            // Use local date string for display
             return date.toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
                 // timeZone: 'UTC' // Uncomment if dates are consistently UTC and showing wrong day
            });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return "Invalid Date";
        }
    }, []);

     // --- Helper: Format Date for Input (YYYY-MM-DD) ---
     const formatDateForInput = useCallback((date) => {
        if (!date) return '';
        const d = new Date(date);
         if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    // --- Fetch Guests ---
    const fetchGuests = useCallback((showLoading = true) => {
        if (showLoading) setIsLoading(true);
        setError(null);
        Axios.post("http://localhost:3001/checkout-today", { hotelID: dummyHID })
            .then((response) => {
                setGuests(response.data || []);
            })
            .catch((error) => {
                console.error("Error fetching guests checking out today:", error);
                setError("Failed to fetch guests. Please try again.");
                setGuests([]);
            })
            .finally(() => {
                if (showLoading) setIsLoading(false);
            });
    }, [dummyHID]);

    // --- Apply Filters ---
    const applyFilters = useCallback(() => {
        setIsLoading(true); // Show loading state while filtering
        setError(null);
         // Prepare filters, remove empty values if backend expects only active filters
        const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => {
            if (value) acc[key] = value;
            return acc;
        }, {});

        Axios.post("http://localhost:3001/filter-checkout", {
            ...activeFilters,
            HotelID: dummyHID,
        })
            .then((response) => {
                setGuests(response.data || []);
                setShowFilterModal(false); // Close modal on success
            })
            .catch((error) => {
                console.error("Error while filtering checkout:", error);
                setError("Failed to apply filters. Please check criteria.");
                // Optionally, keep the modal open on error or show error message inside modal
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [filters, dummyHID]);

    // --- Initial Fetch ---
    useEffect(() => {
        if (!dummyHID) {
            setError("Hotel ID not found. Please log in again.");
            setIsLoading(false);
            // navigate('/login'); // Redirect if needed
            return;
        }
        fetchGuests();
    }, [fetchGuests, dummyHID, navigate]);

     // --- Escape Key Listener for Modals ---
     useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowFilterModal(false);
                setShowExtendPopup(false);
                setShowBillingPopup(false); // Assuming BillingPopup also closes on Escape
            }
        };
        // Add listener only when a modal/popup is open
        if (showFilterModal || showExtendPopup || showBillingPopup) {
             window.addEventListener('keydown', handleEscape);
        }
         // Cleanup function
         return () => window.removeEventListener('keydown', handleEscape);
     }, [showFilterModal, showExtendPopup, showBillingPopup]);


    // --- Event Handlers ---
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prevFilter) => ({
            ...prevFilter,
            [name]: value,
        }));
    };

    const handleExtendVisitClick = (guest) => {
        if (!guest || !guest.CheckOutDate) {
             console.error("Cannot extend visit: Missing guest data or checkout date.");
             alert("Error: Cannot prepare extension form.");
             return;
        }
        setSelectedGuest(guest);
        // Set min date for the input to be the day AFTER the current checkout date
        const currentCheckout = new Date(guest.CheckOutDate);
        currentCheckout.setDate(currentCheckout.getDate() + 1); // Day after
        setMinCheckoutDate(formatDateForInput(currentCheckout));
        setNewCheckoutDate(''); // Reset date input
        setShowExtendPopup(true);
    };

    const handleConfirmExtendVisit = () => {
        if (!newCheckoutDate) {
            alert("Please select a new checkout date.");
            return;
        }
        if (!selectedGuest || !selectedGuest.GuestID) {
            alert("Error: Guest information is missing.");
            return;
        }

        // Optional: Basic date validation (ensure it's after min date)
        if (new Date(newCheckoutDate) <= new Date(selectedGuest.CheckOutDate)) {
             alert("New checkout date must be after the current one.");
             return;
        }

        setIsExtending(true);
        Axios.post("http://localhost:3001/extend-visit", {
            guestID: selectedGuest.GuestID,
            newCheckoutDate: newCheckoutDate, // Already in YYYY-MM-DD format from input type="date"
        })
            .then(() => {
                alert("Checkout date updated successfully.");
                setShowExtendPopup(false);
                setSelectedGuest(null);
                fetchGuests(false); // Refresh list without full loading indicator
            })
            .catch((error) => {
                console.error("Error extending visit:", error);
                const errorMessage = error.response?.data?.message || "Failed to extend visit. Please try again.";
                alert(`Error: ${errorMessage}`);
                 // Keep popup open on error? Optional.
            })
            .finally(() => {
                 setIsExtending(false);
            });
    };

    const openBillingPopup = (guest) => {
        setSelectedGuest(guest);
        setShowBillingPopup(true);
    };

    const closeBillingPopup = () => {
        setShowBillingPopup(false);
        setSelectedGuest(null); // Clear selected guest when closing billing
    };

    // --- Render Functions ---
    const renderLoading = () => (
        <div className="loading-indicator"> {/* Use consistent loading style */}
            <div className="spinner"></div>
            <p>Loading Guests...</p>
        </div>
    );

    const renderError = () => (
        <div className="realcheckout-no-guests"> {/* Reuse style */}
            <FiInfo className="icon" style={{ color: 'var(--accent-color)' }} /> {/* Error color */}
            <h2>Error Fetching Data</h2>
            <p>{error || "An unexpected error occurred."}</p>
            <button className="realcheckout-filter-button" onClick={() => fetchGuests()}>
                Try Again
            </button>
        </div>
    );

    const renderNoGuests = () => (
        <div className="realcheckout-no-guests">
            <FiUsers className="icon" />
            <h2>No Guests Checking Out Today</h2>
            <p>There are currently no guests scheduled for checkout today based on the current filters.</p>
            <button className="realcheckout-filter-button" onClick={() => setShowFilterModal(true)}>
                <FiFilter /> Adjust Filters
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="realcheckout-table-container">
            <table className="realcheckout-table">
                <thead>
                    <tr>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>NID</th>
                        <th>Date of Birth</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {guests.map((guest) => ( // Use unique GuestID if available
                        <tr key={guest.GuestID || guest.NID}>
                            <td>{guest.FirstName || 'N/A'}</td>
                            <td>{guest.LastName || 'N/A'}</td>
                            <td>{guest.EmailAddress || 'N/A'}</td>
                            <td>{guest.PhoneNumber || 'N/A'}</td>
                            <td>{guest.NID || 'N/A'}</td>
                            <td>{formatDateForDisplay(guest.DateOfBirth)}</td>
                            <td>
                                <div className="realcheckout-action-buttons">
                                    <button
                                        className="realcheckout-billing-button"
                                        onClick={() => openBillingPopup(guest)}
                                        title="View Billing"
                                    >
                                        <FiCreditCard size={14}/> Billing
                                    </button>
                                    <button
                                        className="realcheckout-extend-button"
                                        onClick={() => handleExtendVisitClick(guest)}
                                        title="Extend Stay"
                                    >
                                        <FiCalendar size={14}/> Extend
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderFilterModal = () => (
        <div className="filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
            <div className="realcheckout-filter-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Filter Guests</h2>
                <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
                    <label htmlFor="filter-FirstName">First Name:</label>
                    <input id="filter-FirstName" type="text" name="FirstName" value={filters.FirstName} onChange={handleFilterChange} placeholder="Filter by first name..."/>
                    <label htmlFor="filter-LastName">Last Name:</label>
                    <input id="filter-LastName" type="text" name="LastName" value={filters.LastName} onChange={handleFilterChange} placeholder="Filter by last name..."/>
                    <label htmlFor="filter-EmailAddress">Email:</label>
                    <input id="filter-EmailAddress" type="email" name="EmailAddress" value={filters.EmailAddress} onChange={handleFilterChange} placeholder="Filter by email..."/>
                    <label htmlFor="filter-PhoneNumber">Phone:</label>
                    <input id="filter-PhoneNumber" type="tel" name="PhoneNumber" value={filters.PhoneNumber} onChange={handleFilterChange} placeholder="Filter by phone..."/>
                    <label htmlFor="filter-NID">NID:</label>
                    <input id="filter-NID" type="text" name="NID" value={filters.NID} onChange={handleFilterChange} placeholder="Filter by National ID..."/>
                    <label htmlFor="filter-DateOfBirth">Date Of Birth:</label>
                    <input id="filter-DateOfBirth" type="date" name="DateOfBirth" value={filters.DateOfBirth} onChange={handleFilterChange} />
                    <div className="realcheckout-filter-actions">
                        <button type="submit" disabled={isLoading}>Apply</button>
                        <button type="button" onClick={() => setShowFilterModal(false)} disabled={isLoading}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );

    const renderExtendPopup = () => (
        <div className="popup-overlay" onClick={() => setShowExtendPopup(false)}>
            <div className="realcheckout-popup" onClick={(e) => e.stopPropagation()}>
                <h2>
                    Extend Visit for {selectedGuest?.FirstName} {selectedGuest?.LastName}
                </h2>
                 <p>Current Checkout: {formatDateForDisplay(selectedGuest?.CheckOutDate)}</p>
                <form onSubmit={(e) => { e.preventDefault(); handleConfirmExtendVisit(); }}>
                    <label htmlFor="extend-checkout-date">New Checkout Date:</label>
                    <input
                        id="extend-checkout-date"
                        type="date"
                        value={newCheckoutDate}
                        onChange={(e) => setNewCheckoutDate(e.target.value)}
                        min={minCheckoutDate} // Ensure new date is after current checkout
                        required
                    />
                    <div className="realcheckout-popup-actions">
                        <button type="submit" disabled={isExtending}>
                            {isExtending ? 'Confirming...' : 'Confirm Extension'}
                        </button>
                        <button type="button" onClick={() => setShowExtendPopup(false)} disabled={isExtending}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // --- Main Return ---
    return (
        <> {/* Use Fragment shorthand */}
            <Navbar />
            <div className="realcheckout-container">
                <div className="realcheckout-header">
                    <h1>Guests Checking Out Today</h1>
                    <button className="realcheckout-filter-button" onClick={() => setShowFilterModal(true)}>
                        <FiFilter /> Filter Guests
                    </button>
                </div>

                {isLoading
                    ? renderLoading()
                    : error
                        ? renderError()
                        : guests.length === 0
                            ? renderNoGuests()
                            : renderTable()
                }

                {/* Conditional Rendering of Modals/Popups */}
                {showExtendPopup && selectedGuest && renderExtendPopup()}
                {showFilterModal && renderFilterModal()}
                {showBillingPopup && selectedGuest && (
                    <BillingPopup guest={selectedGuest} onClose={closeBillingPopup} />
                     /* Ensure BillingPopup uses an overlay or is styled consistently */
                )}
            </div>
        </>
    );
};

// Export with the new name
export default GuestsCheckingOut;

// --- END OF FILE RealCheckout.js ---