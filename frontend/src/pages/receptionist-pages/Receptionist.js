// --- START OF FILE Receptionist.js ---

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import "./Receptionist.css"; // Import your CSS file for styling
import Axios from "axios";
import { FiSearch, FiArrowRight, FiCheckSquare, FiXSquare, FiSave, FiXCircle, FiUserPlus, FiCalendar, FiDollarSign, FiUsers, FiFilter, FiSquare } from "react-icons/fi"; // Added FiSquare here

const Receptionist = () => {
  const dummyHID = localStorage.getItem("hotelID");
  const dummyEID = localStorage.getItem("userID");
  const navigate = useNavigate();

  // --- State ---
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // Store only IDs
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState(null);

  // Guest & Booking State
  const [guestDetails, setGuestDetails] = useState({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      nid: "",
      dob: "",
  });
  const [bookingDetails, setBookingDetails] = useState({
    checkInDate: "",
    checkOutDate: "",
    numAdults: 1,
    numChildren: 0,
    deposite: 0,
  });

  // UI Control State
  const [showRoomsSection, setShowRoomsSection] = useState(true);
  const [showGuestAndBookingSection, setShowGuestAndBookingSection] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Filter State
  const today = new Date();
  const formatDate = (date) => date.toISOString().split("T")[0];
  const [filters, setFilters] = useState({
    minPrice: "", // Use empty string for optional filters
    maxPrice: "",
    bedType: "Any",
    classType: "Any",
    maxOccupancy: "",
    checkInDate: formatDate(today),
    checkOutDate: formatDate(new Date(today.setDate(today.getDate() + 1))), // Default to tomorrow
  });

  // --- Fetching Functions ---
  const fetchAvailableRooms = useCallback((filterParams = {}) => {
    setIsLoadingRooms(true);
    setRoomError(null);

    // Use current filter state if no specific params passed
    const paramsToSend = Object.keys(filterParams).length > 0 ? filterParams : filters;

     // Prepare parameters, sending null or omitting if empty/default where appropriate
    const requestData = {
        minPrice: paramsToSend.minPrice || null,
        maxPrice: paramsToSend.maxPrice || null,
        bedType: paramsToSend.bedType === "Any" ? null : paramsToSend.bedType,
        classType: paramsToSend.classType === "Any" ? null : paramsToSend.classType,
        maxOccupancy: paramsToSend.maxOccupancy || null,
        checkInDate: paramsToSend.checkInDate || formatDate(new Date()), // Fallback
        checkOutDate: paramsToSend.checkOutDate || formatDate(new Date(new Date().setDate(new Date().getDate() + 1))), // Fallback
        hotelID: dummyHID,
    };

    // Decide endpoint based on whether filters are active
    const endpoint = (requestData.minPrice || requestData.maxPrice || requestData.bedType || requestData.classType || requestData.maxOccupancy)
        ? "http://localhost:3001/filter-rooms"
        : "http://localhost:3001/available-rooms"; // Use simpler endpoint if no filters active

    Axios.post(endpoint, requestData)
      .then((response) => {
        setAvailableRooms(response.data || []);
         if (Object.keys(filterParams).length > 0) {
             setShowFilterModal(false); // Close modal only if applying filters explicitly
         }
      })
      .catch((error) => {
        console.error("Error fetching available rooms:", error);
        setRoomError("Failed to fetch rooms. Please try again.");
        setAvailableRooms([]);
      })
      .finally(() => {
        setIsLoadingRooms(false);
      });
  }, [dummyHID, filters]); // Include filters in dependency array


  // --- Initial Room Fetch ---
  useEffect(() => {
    if (!dummyHID) {
         setRoomError("Hotel ID not found. Please log in.");
         setIsLoadingRooms(false);
         return;
    }
    if (showRoomsSection) {
      fetchAvailableRooms(); // Fetch initial unfiltered rooms
    }
  }, [showRoomsSection, fetchAvailableRooms, dummyHID]); // Add dummyHID

  // --- Event Handlers ---
  const handleFilterChange = (e) => {
    const { name, value, type } = e.target;
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: type === 'number' ? (value ? Number(value) : "") : value, // Handle number conversion, allow empty
    }));
  };

  const applyFilters = () => {
      // Basic validation for dates
      if (!filters.checkInDate || !filters.checkOutDate) {
          alert("Please select both Check-In and Check-Out dates.");
          return;
      }
      if (new Date(filters.checkOutDate) <= new Date(filters.checkInDate)) {
           alert("Check-Out date must be after Check-In date.");
           return;
      }
      fetchAvailableRooms(filters); // Pass current filters explicitly
  };

  const handleRoomSelection = (roomId) => {
    setSelectedRoomIds((prevSelected) =>
      prevSelected.includes(roomId)
        ? prevSelected.filter((id) => id !== roomId)
        : [...prevSelected, roomId]
    );
  };

  const handleProceedToGuestDetails = () => {
    if (selectedRoomIds.length === 0) {
      alert("Please select at least one room.");
      return;
    }
    setShowRoomsSection(false);
    setShowGuestAndBookingSection(true);
  };

  const handleGuestInputChange = (e) => {
    const { name, value } = e.target;
    setGuestDetails((prevDetails) => ({ ...prevDetails, [name]: value }));
  };

  const handleBookingInputChange = (e) => {
    const { name, value, type } = e.target;
    setBookingDetails((prevDetails) => ({
      ...prevDetails,
      [name]: type === 'number' ? (value ? Number(value) : 0) : value, // Handle number conversion, default to 0
    }));
  };

  const handleConfirmBooking = () => {
    // Validation
    if (selectedRoomIds.length === 0) {
      alert("Error: No rooms selected."); return;
    }
    const requiredGuestFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'dob', 'nid'];
    if (requiredGuestFields.some(field => !guestDetails[field])) {
      alert("Please fill in all required Guest Details."); return;
    }
     const requiredBookingFields = ['checkInDate', 'checkOutDate'];
     if (requiredBookingFields.some(field => !bookingDetails[field])) {
       alert("Please fill in all required Booking Details (Check-in/out dates)."); return;
     }
     if (new Date(bookingDetails.checkOutDate) <= new Date(bookingDetails.checkInDate)) {
        alert("Booking Check-Out date must be after Check-In date."); return;
     }
      if (bookingDetails.numAdults < 1) {
        alert("Booking must include at least one adult."); return;
      }

    setIsSubmittingBooking(true);
    Axios.post("http://localhost:3001/add-guest", {
      // Guest Details
      firstName: guestDetails.firstName.trim(),
      lastName: guestDetails.lastName.trim(),
      email: guestDetails.email.trim(),
      phoneNumber: guestDetails.phoneNumber.trim(),
      dob: guestDetails.dob,
      nid: guestDetails.nid.trim(),
      // Booking Details
      hotelID: dummyHID,
      empID: dummyEID,
      selectedRooms: selectedRoomIds,
      checkInDate: bookingDetails.checkInDate,
      checkOutDate: bookingDetails.checkOutDate,
      numAdults: bookingDetails.numAdults,
      numChildren: bookingDetails.numChildren,
      deposite: bookingDetails.deposite || 0, // Ensure deposit is a number
      })
      .then(() => {
        alert("Booking confirmed successfully!");
        // Reset state
        setSelectedRoomIds([]);
        setGuestDetails({ firstName: "", lastName: "", email: "", phoneNumber: "", nid: "", dob: "" });
        setBookingDetails({ checkInDate: "", checkOutDate: "", numAdults: 1, numChildren: 0, deposite: 0 });
        setShowGuestAndBookingSection(false);
        setShowRoomsSection(true); // Go back to room selection
        // Optionally trigger a refresh of rooms: fetchAvailableRooms();
      })
      .catch((error) => {
        console.error("Error confirming booking:", error);
        const errMsg = error.response?.data?.message || "Failed to confirm booking. Please check details or try again.";
        alert(`Error: ${errMsg}`);
      })
      .finally(() => {
        setIsSubmittingBooking(false);
      });
  };

  const handleCancelBookingProcess = () => {
      // Clear selection and go back to room view
      setSelectedRoomIds([]);
      setShowGuestAndBookingSection(false);
      setShowRoomsSection(true);
  }

  // --- Render Functions ---

  const renderRoomTable = () => (
    <div className="rooms-table-container">
        <table className="rooms-table">
            <thead>
                <tr>
                    <th>Room Number</th>
                    <th>Class</th>
                    <th>Bed Type</th>
                    <th>Price ($)</th>
                    <th>Max Occupancy</th>
                    <th>Select</th> {/* Or remove if row click selects */}
                </tr>
            </thead>
            <tbody>
                {availableRooms.map((room) => (
                    <tr
                        key={room.RoomID}
                        className={selectedRoomIds.includes(room.RoomID) ? "selected-row" : ""}
                        onClick={() => handleRoomSelection(room.RoomID)} // Select on row click
                    >
                        <td>{room.RoomNumber}</td>
                        <td>{room.ClassType}</td>
                        <td>{room.BedType}</td>
                        // Inside the map function:
                        <td>
        {(() => { // Start the IIFE wrapper: (() => { ... })()
            const price = parseFloat(room.BasePrice); // Now variable declaration is fine inside the function
            if (!isNaN(price)) { // Use an if statement for clarity
                return `$${price.toFixed(2)}`; // Return the desired string
            }
            return 'N/A'; // Return the fallback string
        })()} {/* Immediately invoke the function */}
    </td>
                        <td>{room.MaxOccupancy}</td>
                        <td className="select-button-cell" onClick={(e) => e.stopPropagation()}> {/* Prevent row click trigger */}
                             {/* Visually indicate selection, e.g., with a check icon */}
                             {selectedRoomIds.includes(room.RoomID) ? (
                                <FiCheckSquare size={20} color="var(--secondary-color)" title="Selected"/>
                             ) : (
                                <FiSquare size={20} color="var(--text-muted)" title="Select"/> // Use FiSquare or similar for unselected
                             )}
                           {/* <button
                                onClick={(e) => { e.stopPropagation(); handleRoomSelection(room.RoomID); }}
                                className={`select-button ${selectedRoomIds.includes(room.RoomID) ? "selected" : ""}`}
                            >
                                {selectedRoomIds.includes(room.RoomID) ? <FiXSquare/> : <FiCheckSquare/>}
                            </button> */}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );

  const renderGuestAndBookingForm = () => (
     <div className="details-section">
        {/* Guest Details Card */}
        <div className="guest-details-card">
            <h2><FiUserPlus/> Guest Details</h2>
            {/* Input Groups */}
            <div className="input-group"> <label htmlFor="firstName">First Name:</label> <input id="firstName" type="text" name="firstName" value={guestDetails.firstName} onChange={handleGuestInputChange} required /> </div>
            <div className="input-group"> <label htmlFor="lastName">Last Name:</label> <input id="lastName" type="text" name="lastName" value={guestDetails.lastName} onChange={handleGuestInputChange} required /> </div>
            <div className="input-group"> <label htmlFor="email">Email:</label> <input id="email" type="email" name="email" value={guestDetails.email} onChange={handleGuestInputChange} required /> </div>
            <div className="input-group"> <label htmlFor="phoneNumber">Phone:</label> <input id="phoneNumber" type="tel" name="phoneNumber" value={guestDetails.phoneNumber} onChange={handleGuestInputChange} required /> </div>
            <div className="input-group"> <label htmlFor="dob">Date of Birth:</label> <input id="dob" type="date" name="dob" value={guestDetails.dob} onChange={handleGuestInputChange} required max={formatDate(new Date())}/> </div>
            <div className="input-group"> <label htmlFor="nid">NID / Passport:</label> <input id="nid" type="text" name="nid" value={guestDetails.nid} onChange={handleGuestInputChange} required /> </div>
        </div>

        {/* Booking Details Card */}
        <div className="booking-details-card">
            <h2><FiCalendar/> Booking Details</h2>
            {/* Input Groups */}
            <div className="input-group"> <label htmlFor="checkInDate">Check-In Date:</label> <input id="checkInDate" type="date" name="checkInDate" value={bookingDetails.checkInDate} onChange={handleBookingInputChange} required min={formatDate(new Date())}/> </div>
            <div className="input-group"> <label htmlFor="checkOutDate">Check-Out Date:</label> <input id="checkOutDate" type="date" name="checkOutDate" value={bookingDetails.checkOutDate} onChange={handleBookingInputChange} required min={bookingDetails.checkInDate || formatDate(new Date())}/> </div>
            <div className="input-group"> <label htmlFor="numAdults">Adults:</label> <input id="numAdults" type="number" name="numAdults" value={bookingDetails.numAdults} onChange={handleBookingInputChange} required min="1" /> </div>
            <div className="input-group"> <label htmlFor="numChildren">Children:</label> <input id="numChildren" type="number" name="numChildren" value={bookingDetails.numChildren} onChange={handleBookingInputChange} required min="0" /> </div>
            <div className="input-group"> <label htmlFor="deposite">Deposit ($):</label> <input id="deposite" type="number" name="deposite" value={bookingDetails.deposite} onChange={handleBookingInputChange} min="0" step="0.01" /> </div>

            <div className="confirm-cancel-buttons">
                <button onClick={handleConfirmBooking} className="confirm-button" disabled={isSubmittingBooking}>
                    <FiSave/> {isSubmittingBooking ? "Submitting..." : "Confirm Booking"}
                </button>
                <button onClick={handleCancelBookingProcess} className="cancel-button" disabled={isSubmittingBooking}>
                    <FiXCircle/> Cancel
                </button>
            </div>
        </div>
    </div>
  );

  const renderFilterModal = () => (
    <div className="filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
        <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
             <h2><FiFilter/> Filter Rooms</h2>
             <form onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
                {/* Filter Inputs */}
                <div className="input-group"><label htmlFor="filter-minPrice">Min Price ($):</label><input id="filter-minPrice" type="number" name="minPrice" min="0" step="0.01" value={filters.minPrice} onChange={handleFilterChange} /></div>
                <div className="input-group"><label htmlFor="filter-maxPrice">Max Price ($):</label><input id="filter-maxPrice" type="number" name="maxPrice" min="0" step="0.01" value={filters.maxPrice} onChange={handleFilterChange} /></div>
                <div className="input-group"><label htmlFor="filter-bedType">Bed Type:</label><select id="filter-bedType" name="bedType" value={filters.bedType} onChange={handleFilterChange}><option>Any</option><option>King</option><option>Queen</option><option>Single</option><option>Double</option><option>Twin</option></select></div>
                <div className="input-group"><label htmlFor="filter-classType">Class Type:</label><select id="filter-classType" name="classType" value={filters.classType} onChange={handleFilterChange}><option>Any</option><option>Standard</option><option>Suite</option><option>Single</option><option>Double</option><option>Family</option></select></div>
                <div className="input-group"><label htmlFor="filter-maxOccupancy">Min Occupancy:</label><input id="filter-maxOccupancy" type="number" name="maxOccupancy" min="1" value={filters.maxOccupancy} onChange={handleFilterChange} /></div>
                <div className="input-group"><label htmlFor="filter-checkInDate">Check-In Date:</label><input id="filter-checkInDate" type="date" name="checkInDate" value={filters.checkInDate} onChange={handleFilterChange} min={formatDate(new Date())}/></div>
                <div className="input-group"><label htmlFor="filter-checkOutDate">Check-Out Date:</label><input id="filter-checkOutDate" type="date" name="checkOutDate" value={filters.checkOutDate} onChange={handleFilterChange} min={filters.checkInDate || formatDate(new Date())}/></div>

                 <div className="modal-buttons">
                    <button type="submit" className="confirm-button" disabled={isLoadingRooms}>Apply Filters</button>
                    <button type="button" className="cancel-button" onClick={() => setShowFilterModal(false)} disabled={isLoadingRooms}>Cancel</button>
                </div>
             </form>
         </div>
     </div>
  );

  // --- Main Return ---
  return (
    <>
      <Navbar />
      <div className="receptionist-container">

        {/* Top Buttons */}
        <div className="button-group">
          {!showGuestAndBookingSection && selectedRoomIds.length > 0 && (
            <button onClick={handleProceedToGuestDetails} className="proceed-button">
              Proceed <FiArrowRight/>
            </button>
          )}
          {showRoomsSection && ( // Only show Search when rooms are visible
             <button onClick={() => setShowFilterModal(true)} className="search-button">
                 <FiSearch/> Search / Filter
             </button>
          )}
        </div>

        {/* Rooms Section */}
        {showRoomsSection && (
          <div className="rooms-section">
            <h2>Available Rooms</h2>
             {isLoadingRooms && <div className="loading-indicator"><div className="spinner"></div><p>Loading rooms...</p></div>}
             {roomError && <div className="error-message"><p>{roomError}</p></div>}
             {!isLoadingRooms && !roomError && availableRooms.length === 0 && <p>No rooms available matching the criteria.</p>}
             {!isLoadingRooms && !roomError && availableRooms.length > 0 && renderRoomTable()}
          </div>
        )}

        {/* Guest and Booking Section */}
        {showGuestAndBookingSection && renderGuestAndBookingForm()}

        {/* Filter Modal */}
        {showFilterModal && renderFilterModal()}

      </div>
    </>
  );
};

export default Receptionist;

// --- END OF FILE Receptionist.js ---