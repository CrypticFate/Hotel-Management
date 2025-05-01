// --- START OF FILE ReceptionistDB.js ---

import React from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { FiBookOpen, FiUsers, FiFileText } from "react-icons/fi"; // Updated icon (FiUsers)
// Assuming DashboardCard component is designed to accept these props
// If DashboardCard is very simple, you might build the card structure here instead
import DashboardCard from "../../components/DashboardCard";
import Navbar from "../../components/Navbar";
import "./ReceptionistDB.css"; // Ensure CSS is imported

const ReceptionistDashboard = () => {
  const navigate = useNavigate(); // Hook for navigation

  // Card data - adjusted paths and potentially icons
  const cards = [
    {
      title: "Room Booking",
      description: "Search for available rooms and create new bookings for guests.",
      color: "#38bdf8", // Use theme primary color
      path: "/receptionist", // Path for booking page
      icon: <FiBookOpen />,
      stat: "Check room availability"
    },
    {
      title: "Current Guests", // Renamed for clarity
      description: "View currently checked-in guests, manage details, and add features.",
      color: "#2dd4bf", // Use theme secondary color
      path: "/checkout", // Path for CURRENT guests list (Checkout.js)
      icon: <FiUsers />, // Icon for guests
      stat: "View and manage stays"
    },
    {
      title: "Today's Checkouts", // Renamed for clarity
      description: "View guests scheduled to check out today and manage billing.",
      color: "#a78bfa", // Use theme accent color
      path: "/real-checkout", // Path for guests checking out TODAY (RealCheckout.js)
      icon: <FiFileText />,
      stat: "Process checkouts and billing"
    }
    // Add more cards if needed
  ];

  // Handle card click navigation
  const handleNavigate = (path) => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <div className="receptionist-dashboard-wrapper">
      <Navbar />
      <div className="receptionist-dashboard-container">
        {/* Optional Header */}
         <header className="dashboard-header">
            <h1 className="dashboard-title">Receptionist Dashboard</h1>
            <div className="header-accent"></div>
          </header>

        <div className="receptionist-grid-container">
          {/* Render cards using map and DashboardCard component or build structure here */}
          {cards.map((card, index) => (
            // Assuming DashboardCard accepts these props and styles internally
            // If not, build the card structure here using the CSS classes
             <div className="dashboard-card" key={index} onClick={() => handleNavigate(card.path)}>
                 <div className="card-header">
                     {card.icon && React.cloneElement(card.icon, { className: 'card-icon', style: { color: card.color } })}
                    <h3>{card.title}</h3>
                 </div>
                 <p>{card.description}</p>
                 {card.stat && <span className="card-stat">{card.stat}</span>}
                 {/* Separate button for navigation is also an option */}
                 {/* <button className="nav-button" onClick={(e) => { e.stopPropagation(); handleNavigate(card.path); }}>
                     Go to {card.title}
                 </button> */}
             </div>

            // <DashboardCard
            //   key={index}
            //   title={card.title}
            //   description={card.description}
            //   color={card.color} // Pass color for icon/accents
            //   navigateTo={card.path}
            //   icon={card.icon}
            //   stat={card.stat}
            // />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistDashboard;

// --- END OF FILE ReceptionistDB.js ---