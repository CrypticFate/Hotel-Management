// --- START OF FILE feature.js ---

import React, { useState, useEffect, useCallback } from "react";
import Axios from "axios";
import "./feature.css"; // Make sure this is imported
import { useLocation, useNavigate } from "react-router-dom"; // Added useNavigate
import Navbar from "../../components/Navbar.js";
import { FiPlus, FiPackage, FiDollarSign, FiInfo } from "react-icons/fi"; // Import icons

const Features = () => {
    const location = useLocation();
    const navigate = useNavigate(); // Hook for navigation
    const roomID = location.state?.roomID;
    const guestID = location.state?.guestID;

    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // State for fetch errors
    const [showNewFeatureForm, setShowNewFeatureForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // State for form submission
    const [newFeature, setNewFeature] = useState({
        featureName: "",
        description: "",
        additionalPrice: "",
    });

    // Fetch features function
    const fetchFeatures = useCallback(() => {
        setLoading(true);
        setError(null); // Reset error before fetching
        Axios.post("http://localhost:3001/features", { roomID, guestID })
            .then((response) => {
                setFeatures(response.data || []); // Ensure features is always an array
            })
            .catch((error) => {
                console.error("Error fetching features:", error);
                setError("Failed to fetch features. Please try again later.");
                setFeatures([]); // Clear features on error
            })
            .finally(() => {
                setLoading(false);
            });
    }, [roomID, guestID]); // Dependencies for fetchFeatures

    // Initial fetch and check for missing IDs
    useEffect(() => {
        if (!roomID || !guestID) {
            console.error("Missing roomID or guestID in location state.");
            setError("Required information (Room or Guest ID) is missing.");
            // Optionally navigate back or show a more prominent error
            // navigate(-1); // Example: go back
            setLoading(false);
            return; // Stop execution if IDs are missing
        }
        fetchFeatures();
    }, [roomID, guestID, fetchFeatures, navigate]); // Add navigate to dependencies if used inside

    // Form input change handler
    const handleNewFeatureChange = (e) => {
        const { name, value } = e.target;
        // Allow only numbers and optional decimal for price
        if (name === "additionalPrice") {
             // Basic validation: allow empty, numbers, and one decimal point
             if (value === '' || /^\d*\.?\d*$/.test(value)) {
                 setNewFeature((prevFeature) => ({
                    ...prevFeature,
                    [name]: value,
                 }));
            }
        } else {
             setNewFeature((prevFeature) => ({
                ...prevFeature,
                [name]: value,
             }));
        }
    };

    // Add new feature handler
    const handleAddNewFeature = (e) => {
        e.preventDefault(); // Prevent default form submission
        if (!newFeature.featureName || !newFeature.additionalPrice) {
            alert("Feature Name and Additional Price are required.");
            return;
        }
         // Convert price to a number, handle potential errors
         const price = parseFloat(newFeature.additionalPrice);
         if (isNaN(price) || price < 0) {
            alert("Please enter a valid positive number for the price.");
            return;
         }

        setIsSubmitting(true);
        Axios.post("http://localhost:3001/add-feature", {
            roomID,
            guestID,
            featureName: newFeature.featureName.trim(), // Trim whitespace
            description: newFeature.description.trim(), // Trim whitespace
            additionalPrice: price, // Send validated number
        })
            .then(() => {
                alert("Feature added successfully!"); // Replace with better notification later
                setShowNewFeatureForm(false);
                setNewFeature({ featureName: "", description: "", additionalPrice: "" }); // Reset form
                fetchFeatures(); // Refresh features list
            })
            .catch((error) => {
                console.error("Error adding new feature:", error);
                 // Provide more specific feedback if possible based on error response
                 const errorMessage = error.response?.data?.message || "Failed to add feature. Please try again.";
                alert(`Error: ${errorMessage}`);
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    // Close modal on Escape key press
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowNewFeatureForm(false);
            }
        };
        if (showNewFeatureForm) { // Only add listener when modal is open
            window.addEventListener('keydown', handleEscape);
        }
        // Cleanup function to remove listener
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showNewFeatureForm]); // Re-run effect when modal visibility changes

    // --- Render Functions ---

    const renderLoading = () => (
        <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading Features...</p>
        </div>
    );

    const renderError = () => (
         <div className="no-features-message"> {/* Reuse style for error */}
             <FiInfo className="icon" /> {/* Info/Error Icon */}
             <h2>Error</h2>
             <p>{error || "An unexpected error occurred."}</p>
             {(!roomID || !guestID) && <p>Please ensure you navigated here correctly.</p>}
             <button className="new-feature-button" onClick={() => navigate(-1)}>Go Back</button>
         </div>
    );

    const renderNoFeatures = () => (
        <div className="no-features-message">
            <FiPackage className="icon" />
            <h2>No Additional Features Added Yet</h2>
            <p>No extra features or services have been added for this guest's stay in Room {roomID}.</p>
            <p>You can add services like late check-out, breakfast, etc., using the button above.</p>
             {/* No need for another 'New Feature' button here, it's in the header */}
        </div>
    );

    const renderFeaturesGrid = () => (
        <div className="features-cards">
            {features.map((feature) => (
                <div className="feature-card" key={feature.FeatureID || feature.featureName}> {/* Use ID if available */}
                    <h3>{feature.FeatureName || 'Unnamed Feature'}</h3>
                    <p className="feature-description">
                        {feature.Description || <em>No description provided.</em>}
                    </p>
                    <p className="feature-price">
                        <FiDollarSign size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>
                        <strong>Price:</strong>
                        {(feature.FeatureAdditionalPrice ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                    </p>
                </div>
            ))}
        </div>
    );

    const renderFormModal = () => (
        <div className="form-modal-overlay" onClick={() => setShowNewFeatureForm(false)}>
            <div className="form-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Add New Feature/Service</h2>
                <form onSubmit={handleAddNewFeature}> {/* Use onSubmit for Enter key submission */}
                    <label htmlFor="featureName">Feature Name:</label>
                    <input
                        id="featureName"
                        type="text"
                        name="featureName"
                        value={newFeature.featureName}
                        onChange={handleNewFeatureChange}
                        placeholder="e.g., Late Check-out, Breakfast Package"
                        required
                        maxLength={100} // Example constraint
                    />
                    <label htmlFor="description">Description (Optional):</label>
                    <textarea
                        id="description"
                        name="description"
                        value={newFeature.description}
                        onChange={handleNewFeatureChange}
                        placeholder="Provide details about the feature"
                        maxLength={255} // Example constraint
                    />
                    <label htmlFor="additionalPrice">Additional Price ($):</label>
                    <input
                        id="additionalPrice"
                        type="text" // Use text to handle decimal input easily with regex
                        inputMode="decimal" // Hint for mobile keyboards
                        name="additionalPrice"
                        value={newFeature.additionalPrice}
                        onChange={handleNewFeatureChange}
                        placeholder="e.g., 25.00"
                        required
                    />
                    <div className="form-actions">
                        <button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Adding...' : 'Add Feature'}
                        </button>
                        <button type="button" onClick={() => setShowNewFeatureForm(false)} disabled={isSubmitting}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // --- Main Return ---
    return (
        <>
            <Navbar />
            <div className="features-container">
                <div className="features-header">
                    <h1>Additional Features & Services</h1>
                    {/* Show button only if IDs are valid and no major error */}
                    {roomID && guestID && !error && (
                        <button
                            className="new-feature-button"
                            onClick={() => setShowNewFeatureForm(true)}
                            disabled={loading} // Disable button while loading initial features
                        >
                            <FiPlus /> New Feature
                        </button>
                    )}
                </div>

                {/* Conditional Rendering Logic */}
                {loading ? (
                    renderLoading()
                ) : error ? (
                     renderError()
                ) : features.length === 0 ? (
                     renderNoFeatures()
                ) : (
                    renderFeaturesGrid()
                )}

                {/* Render Modal */}
                {showNewFeatureForm && renderFormModal()}
            </div>
        </>
    );
};

export default Features;

// --- END OF FILE feature.js ---