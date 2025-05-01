// --- START OF FILE Checkout.js ---

import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import { useNavigate } from "react-router-dom";
import Axios from "axios";
import "./Checkout.css"; // Ensure this CSS file is imported
import Navbar from "../../components/Navbar.js";
import {
    FiFilter, FiUsers, FiChevronDown, FiChevronUp, FiPlusCircle,
    FiImage, FiSlash // Import icons (FiSlash for No Guests)
} from "react-icons/fi";


const CurrentGuests = () => {
    const dummyHID = localStorage.getItem("hotelID");
    const navigate = useNavigate();

    const [guests, setGuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        email: "",
        guestID: "",
        fromDate: "",
        toDate: "",
    });

    // --- Helper Functions ---
    const formatDate = useCallback((dateString) => { // Wrapped in useCallback
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            // Optional: Check if date is valid
             if (isNaN(date.getTime())) {
                throw new Error("Invalid Date");
            }
            // Use UTC date parts to avoid timezone shifts if backend stores UTC dates
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC' // Specify timezone if dates come as UTC midnight
            });
             // Or use local time if backend stores local check-in date/time:
            // return date.toLocaleDateString(undefined, {
            //     year: 'numeric', month: 'long', day: 'numeric'
            // });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date'; // Return a clearer error indicator
        }
    }, []); // No dependencies, stable function

    const processGuestData = useCallback((guestData) => { // useCallback for processing
        return guestData
            .map(g => ({
                ...g,
                showDetails: false,
                // Format dates during processing
                CheckInDate: formatDate(g.CheckInDate),
                CheckOutDate: formatDate(g.CheckOutDate),
            }))
            .sort((a, b) => {
                // Robust sorting for room numbers (handles text/numbers)
                const roomA = String(a.RoomNumber || '').toLowerCase();
                const roomB = String(b.RoomNumber || '').toLowerCase();
                // Use numeric option for localeCompare
                return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
            });
    }, [formatDate]); // Dependency on formatDate

    const fetchGuests = useCallback((showLoading = true) => {
        if (showLoading) setIsLoading(true);
        Axios.post("http://localhost:3001/current-guests", { hotelID: dummyHID })
            .then((response) => {
                setGuests(processGuestData(response.data));
            })
            .catch((error) => {
                console.error("Error fetching current guests:", error);
                // TODO: Implement user-friendly error notification (e.g., toast)
                alert("Failed to fetch guests. Please try again later.");
                setGuests([]); // Clear guests on error
            })
            .finally(() => {
                if (showLoading) setIsLoading(false);
            });
    }, [dummyHID, processGuestData]); // Dependencies

    const applyFilters = useCallback(() => {
        setIsLoading(true);
        // Prepare filters, removing empty ones if necessary for the backend
        const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => {
            if (value) acc[key] = value;
            return acc;
        }, {});

        Axios.post("http://localhost:3001/filter-guests", {
            ...activeFilters,
            hotelID: dummyHID,
        })
            .then((response) => {
                setGuests(processGuestData(response.data));
                setShowFilterModal(false);
            })
            .catch((error) => {
                console.error("Error applying filters:", error);
                 // TODO: Implement user-friendly error notification
                alert("Failed to apply filters. Please check console for details.");
                // Optionally revert to showing all guests or keep the current (filtered) view?
                // fetchGuests(false); // Example: fetch all if filter fails
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [filters, dummyHID, processGuestData, fetchGuests]); // Added fetchGuests as potential dependency


    // --- Effects ---
    useEffect(() => {
        fetchGuests(); // Initial fetch
    }, [fetchGuests]); // Dependency array includes fetchGuests

    // Close modal on Escape key press
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowFilterModal(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    // --- Event Handlers ---
    const toggleDetails = (index) => {
        setGuests(prevGuests =>
            prevGuests.map((guest, idx) =>
                idx === index ? { ...guest, showDetails: !guest.showDetails } : guest
            )
        );
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prevFilters) => ({
            ...prevFilters,
            [name]: value,
        }));
    };

    const handleNavigateToFeatures = (roomID, guestID) => {
         if (!roomID || !guestID) {
            console.error("Missing RoomID or GuestID for navigation");
            alert("Cannot navigate to features: Missing required information.");
            return;
         }
         navigate("/feature", { state: { roomID, guestID } });
    };

     const handleOverlayClick = () => {
         setShowFilterModal(false);
     };

     const handleModalContentClick = (e) => {
         e.stopPropagation(); // Prevent overlay click when clicking inside modal
     };

    // --- Render Logic ---
    const renderLoading = () => (
        <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading Guests...</p>
        </div>
    );

    const renderNoGuests = () => (
        <div className="no-guests-found">
            <FiSlash className="no-guests-icon" />
            <h2>No Guests Found</h2>
            <p>
                There are currently no guests matching your criteria. Try adjusting
                the filters or click "Show Current" to view all checked-in guests.
            </p>
        </div>
    );

    const renderGuestCards = () => (
        <div className="guest-cards">
            {guests.map((guest, index) => (
                <div
                    className="guest-card-row"
                    key={guest.BookingID || guest.GuestID || index} // Prioritize unique IDs
                    data-details-visible={guest.showDetails} // Add data attribute for CSS targeting
                >
                    <div className="guest-image-container">
                        {guest.RoomImage ? (
                            <img
                                src={`data:image/jpeg;base64,${guest.RoomImage}`}
                                alt={`Room ${guest.RoomNumber || 'N/A'}`}
                                className="guest-room-image"
                                loading="lazy"
                            />
                        ) : (
                            <div className="guest-no-image">
                                <FiImage size={50} />
                                <span>No Image</span>
                            </div>
                        )}
                    </div>

                    <div className="guest-info-container">
                        <div> {/* Top part of the info */}
                            <div className="guest-header">
                                <div>
                                    {/* Swapped order for better hierarchy */}
                                    <h3>{guest.FirstName} {guest.LastName}</h3>
                                    <h4><strong>Room:</strong> {guest.RoomNumber || 'N/A'}</h4>
                                </div>
                                <button
                                    className="details-toggle-button"
                                    onClick={() => toggleDetails(index)}
                                    aria-expanded={guest.showDetails}
                                    aria-controls={`guest-details-${index}`} // Link button to details
                                >
                                    {guest.showDetails ? <FiChevronUp /> : <FiChevronDown />}
                                    {guest.showDetails ? 'Hide' : 'Details'}
                                </button>
                            </div>

                            {/* Conditionally render expanded info */}
                            {guest.showDetails && (
                                <div className="guest-expanded-info" id={`guest-details-${index}`}>
                                    <p><strong>Guest ID:</strong> {guest.GuestID || 'N/A'}</p>
                                    <p><strong>Email:</strong> {guest.EmailAddress || 'N/A'}</p>
                                    <p><strong>Phone:</strong> {guest.PhoneNumber || 'N/A'}</p>
                                    <p><strong>Check-In:</strong> {guest.CheckInDate}</p>
                                    <p><strong>Check-Out:</strong> {guest.CheckOutDate}</p>
                                    <p><strong>Adults:</strong> {guest.NumAdults ?? 'N/A'}</p>
                                    <p><strong>Children:</strong> {guest.NumChildren ?? 'N/A'}</p>
                                </div>
                            )}
                        </div>

                        {/* Guest Actions - Conditionally rendered */}
                        {guest.showDetails && (
                            <div className="guest-actions">
                                <button
                                    className="features-button"
                                    onClick={() => handleNavigateToFeatures(guest.RoomID, guest.GuestID)}
                                    disabled={!guest.RoomID || !guest.GuestID} // Disable if IDs missing
                                >
                                    <FiPlusCircle /> Add Features
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderFilterModal = () => (
        <div className="filter-modal-overlay" onClick={handleOverlayClick}>
            <div className="filter-modal" onClick={handleModalContentClick}>
                <h2>Filter Guests</h2>
                <label htmlFor="filter-firstName">First Name:</label>
                <input id="filter-firstName" type="text" name="firstName" value={filters.firstName} onChange={handleFilterChange} placeholder="Enter first name..."/>
                <label htmlFor="filter-lastName">Last Name:</label>
                <input id="filter-lastName" type="text" name="lastName" value={filters.lastName} onChange={handleFilterChange} placeholder="Enter last name..."/>
                <label htmlFor="filter-phoneNumber">Phone Number:</label>
                <input id="filter-phoneNumber" type="tel" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} placeholder="Enter phone number..."/>
                <label htmlFor="filter-email">Email:</label>
                <input id="filter-email" type="email" name="email" value={filters.email} onChange={handleFilterChange} placeholder="Enter email address..."/>
                <label htmlFor="filter-guestId">Guest ID:</label>
                <input id="filter-guestId" type="text" name="guestID" value={filters.guestID} onChange={handleFilterChange} placeholder="Enter guest ID..."/>
                <label htmlFor="filter-fromDate">From Check-in Date:</label>
                <input id="filter-fromDate" type="date" name="fromDate" value={filters.fromDate} onChange={handleFilterChange} />
                <label htmlFor="filter-toDate">To Check-in Date:</label>
                <input id="filter-toDate" type="date" name="toDate" value={filters.toDate} onChange={handleFilterChange} min={filters.fromDate || undefined} />

                <div className="filter-actions">
                    <button onClick={applyFilters}>Apply Filters</button>
                    <button onClick={() => setShowFilterModal(false)}>Cancel</button>
                </div>
            </div>
        </div>
    );

    // --- Main Return ---
    return (
        <>
            <Navbar />
            <div className="current-guests-container">
                <div className="current-guests-header">
                    <button className="filter-guests-button" onClick={() => setShowFilterModal(true)}>
                        <FiFilter /> Filter Guests
                    </button>
                    <button className="show-current-guest-button" onClick={() => fetchGuests()}>
                        <FiUsers /> Show Current
                    </button>
                </div>

                {isLoading
                    ? renderLoading()
                    : guests.length === 0
                        ? renderNoGuests()
                        : renderGuestCards()}

                {/* Filter Modal */}
                {showFilterModal && renderFilterModal()}
            </div>
        </>
    );
};

export default CurrentGuests;

// --- END OF FILE Checkout.js ---