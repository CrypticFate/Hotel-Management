// --- START OF FILE ManagerDash.js ---

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Use navigate for card clicks
import Axios from 'axios'; // To fetch data
import {
    FiUsers, FiDollarSign, FiHome, FiPackage, FiTrendingUp, FiTrendingDown,
    FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiBarChart2, FiPieChart, FiCalendar, FiFileText // Add more icons
} from 'react-icons/fi';
import DashboardCard from "../../components/DashboardCard"; // Assuming this component is styled
import Navbar from "../../components/Navbar";
import "./ManagerDash.css"; // Import the updated CSS

// Placeholder Chart Components (Replace with your actual chart library implementation)
const ChartPlaceholder = ({ title }) => (
    <div className="chart-placeholder">
        <FiBarChart2 size={40} /> <span style={{ marginLeft: '10px' }}>{title} Chart Placeholder</span>
    </div>
);
// const RevenueChart = ({ data }) => { /* Your Chart.js/Recharts component */ return <ChartPlaceholder title="Revenue Trend" />; }
// const OccupancyChart = ({ data }) => { /* Your Chart.js/Recharts component */ return <ChartPlaceholder title="Occupancy by Type" />; }

// Placeholder KPI Card Component (Or integrate styling into DashboardCard if suitable)
const KpiCard = ({ title, value, icon, trend, trendType }) => {
    const trendClass = trendType === 'positive' ? 'positive' : trendType === 'negative' ? 'negative' : 'neutral';
    return (
        <div className="stat-card">
            <div className="stat-card-header">
                <h3>{title}</h3>
                {icon && React.cloneElement(icon, { className: 'stat-icon' })}
            </div>
            <p className="stat-value">{value}</p>
            {trend && <span className={`stat-trend ${trendClass}`}>{trend}</span>}
        </div>
    );
};


const ManagerDashboard = () => {
    const hotelId = localStorage.getItem("hotelID");
    const navigate = useNavigate();

    // --- State for Fetched Data ---
    const [kpiData, setKpiData] = useState({
        totalRevenue: { value: '$0', trend: '0%', type: 'neutral' },
        occupancyRate: { value: '0%', trend: '0%', type: 'neutral' },
        avgDailyRate: { value: '$0', trend: '0%', type: 'neutral' },
        guestSatisfaction: { value: 'N/A', trend: '0%', type: 'neutral' },
    });
    const [chartData, setChartData] = useState({ revenue: null, occupancy: null });
    const [activityLog, setActivityLog] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (!hotelId) {
            setError("Hotel ID not found. Please log in.");
            setIsLoading(false);
            // navigate('/login'); // Optional: redirect if critical
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // --- Replace with your actual API calls ---
                const kpiResponse = await Promise.resolve({ // Placeholder data
                    data: {
                        totalRevenue: { value: '$24,580', trend: '+8.5%', type: 'positive' },
                        occupancyRate: { value: '78%', trend: '+2%', type: 'positive' },
                        avgDailyRate: { value: '$185.50', trend: '-1.2%', type: 'negative' },
                        guestSatisfaction: { value: '92%', trend: '+1%', type: 'positive' },
                    }
                }); // await Axios.get(`/api/manager/kpis/${hotelId}`);

                const activityResponse = await Promise.resolve({ // Placeholder data
                   data: [
                        { id: 1, type: 'check-in', description: 'Guest John Doe (Room 102)', time: '14:30' },
                        { id: 2, type: 'check-out', description: 'Guest Jane Smith (Room 205)', time: '11:00' },
                        { id: 3, type: 'booking', description: 'New booking for Room 301', time: '10:15' },
                   ]
                }); // await Axios.get(`/api/manager/activity/${hotelId}`);

                 const alertsResponse = await Promise.resolve({ // Placeholder data
                     data: [
                         { id: 1, type: 'low-stock', description: 'Towels below threshold (15 left)', time: '08:00' },
                         { id: 2, type: 'maintenance', description: 'AC Unit Room 404 reported issue', time: 'Yesterday' },
                     ]
                 }); // await Axios.get(`/api/manager/alerts/${hotelId}`);

                 const revenueChartResponse = await Promise.resolve({data: {/* chart data */}}); // Fetch chart data
                 const occupancyChartResponse = await Promise.resolve({data: {/* chart data */}}); // Fetch chart data
                // --- End of Placeholder API calls ---


                setKpiData(kpiResponse.data);
                setActivityLog(activityResponse.data);
                setAlerts(alertsResponse.data);
                setChartData({ revenue: revenueChartResponse.data, occupancy: occupancyChartResponse.data });

            } catch (err) {
                console.error("Error fetching manager dashboard data:", err);
                setError("Failed to load dashboard data. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [hotelId]); // Refetch if hotelId changes


    // --- Navigation Card Data ---
    const navCards = [
         { title: "Employee Info", description: "Manage employee records & permissions", color: "#3B82F6", path: "/employee-info", icon: <FiUsers /> },
         { title: "Financial Reports", description: "View detailed financial summaries", color: "#10B981", path: `/financial-report-manager/${hotelId}`, icon: <FiDollarSign /> },
         { title: "Room Management", description: "Oversee room status and details", color: "#F59E0B", path: "/rooms", icon: <FiHome /> },
         { title: "Inventory", description: "Track stock levels and manage items", color: "#8B5CF6", path: "/inventory", icon: <FiPackage /> },
         { title: "Inventory Ledger", description: "View inventory transaction history", color: "#6366F1", path: "/ledgerbook", icon: <FiFileText /> }, // Changed color slightly
         { title: "Billing Ledger", description: "Track guest bills and payments", color: "#EC4899", path: "/billledger", icon: <FiCreditCard /> } // Changed color and icon
    ];

     // Handle card click navigation
    const handleNavigate = (path) => {
        if (path) {
        navigate(path);
        }
    };


    // --- Render Logic ---
    if (isLoading) {
         return (
             <div className="dashboard-wrapper">
                 <Navbar />
                 <div className="loading-indicator" style={{ paddingTop: '5rem' }}> {/* Reuse loading style */}
                     <div className="spinner"></div>
                     <p>Loading Manager Dashboard...</p>
                 </div>
             </div>
         );
    }

     if (error) {
         return (
             <div className="dashboard-wrapper">
                 <Navbar />
                  <div className="error-message" style={{ margin: '2rem' }}> {/* Reuse error style */}
                     <FiAlertTriangle size={24}/>
                     <p>{error}</p>
                      {/* Optional: Retry button */}
                  </div>
             </div>
         );
     }


    return (
        <div className="dashboard-wrapper">
            <Navbar />
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <h1 className="dashboard-title">Manager Dashboard</h1>
                    {/* Optional: Add Date Range Selector Component Here */}
                    {/* <div className="date-range-selector">Date Range: Last 30 Days</div> */}
                </header>

                {/* KPI Section */}
                <section className="stats-container">
                    <KpiCard title="Total Revenue" value={kpiData.totalRevenue.value} icon={<FiDollarSign />} trend={kpiData.totalRevenue.trend} trendType={kpiData.totalRevenue.type} />
                    <KpiCard title="Occupancy Rate" value={kpiData.occupancyRate.value} icon={<FiHome />} trend={kpiData.occupancyRate.trend} trendType={kpiData.occupancyRate.type} />
                    <KpiCard title="Avg. Daily Rate" value={kpiData.avgDailyRate.value} icon={<FiTrendingUp />} trend={kpiData.avgDailyRate.trend} trendType={kpiData.avgDailyRate.type} />
                    <KpiCard title="Guest Satisfaction" value={kpiData.guestSatisfaction.value} icon={<FiCheckCircle />} trend={kpiData.guestSatisfaction.trend} trendType={kpiData.guestSatisfaction.type} />
                </section>

                {/* Main Content Area */}
                <section className="dashboard-main-content">
                    {/* Left Column: Charts & Activity */}
                    <div className="main-column">
                        <div className="dashboard-section">
                            <h2 className="dashboard-section-title"><span className="title-icon"><FiBarChart2 /></span>Revenue Trends</h2>
                            <div className="chart-container">
                                {/* Replace with actual chart component */}
                                <ChartPlaceholder title="Revenue Trend" />
                                {/* <RevenueChart data={chartData.revenue} /> */}
                            </div>
                        </div>

                         <div className="dashboard-section">
                            <h2 className="dashboard-section-title"><span className="title-icon"><FiPieChart style={{color: 'var(--secondary-color)'}}/></span>Occupancy Analysis</h2>
                            <div className="chart-container">
                                {/* Replace with actual chart component */}
                                <ChartPlaceholder title="Occupancy by Room Type" />
                                 {/* <OccupancyChart data={chartData.occupancy} /> */}
                            </div>
                        </div>

                        <div className="dashboard-section">
                             <h2 className="dashboard-section-title"><span className="title-icon"><FiActivity style={{color: 'var(--accent-color)'}}/></span>Today's Activity</h2>
                             <ul className="activity-list">
                                 {activityLog.length > 0 ? activityLog.map(item => (
                                     <li key={item.id}>
                                         {item.type === 'check-in' && <FiLogIn className="item-icon check-in"/>}
                                         {item.type === 'check-out' && <FiLogOut className="item-icon check-out"/>}
                                         {item.type === 'booking' && <FiCalendar className="item-icon"/>}
                                         <span>{item.description}</span>
                                         <span className="item-time">{item.time}</span>
                                     </li>
                                 )) : (
                                     <li>No recent activity recorded.</li>
                                 )}
                             </ul>
                         </div>
                    </div>

                    {/* Right Column: Navigation & Alerts */}
                    <div className="sidebar-column">
                         <div className="dashboard-section">
                              <h2 className="dashboard-section-title"><span className="title-icon"><FiAlertTriangle style={{color: 'var(--warning-color)'}}/></span>Alerts & Notifications</h2>
                               <ul className="alerts-list">
                                   {alerts.length > 0 ? alerts.map(item => (
                                     <li key={item.id}>
                                         {item.type === 'low-stock' && <FiPackage className="item-icon low-stock"/>}
                                         {item.type === 'maintenance' && <FiTool className="item-icon urgent"/>}
                                         {/* Add other alert types */}
                                         <span>{item.description}</span>
                                         <span className="item-time">{item.time}</span>
                                     </li>
                                  )) : (
                                     <li>No current alerts.</li>
                                  )}
                               </ul>
                         </div>

                        <div className="dashboard-section">
                             <h2 className="dashboard-section-title"><span className="title-icon"><FiNavigation style={{color: 'var(--primary-color)'}} /></span>Management Areas</h2>
                             <div className="navigation-grid">
                                {navCards.map((card, index) => (
                                    // Use DashboardCard component if it's properly styled and accepts props
                                    <DashboardCard
                                        key={index}
                                        title={card.title}
                                        description={card.description}
                                        color={card.color} // Pass color for icon styling within the component
                                        navigateTo={card.path}
                                        icon={card.icon} // Pass the icon element
                                        // stat={card.stat} // Optional stat text
                                    />
                                    // Or build the card structure directly if DashboardCard is simple:
                                    // <div className="dashboard-card" key={index} onClick={() => handleNavigate(card.path)}>
                                    //     <div className="card-header">
                                    //         {card.icon && React.cloneElement(card.icon, { className: 'card-icon', style: { color: card.color } })}
                                    //         <h3>{card.title}</h3>
                                    //     </div>
                                    //     <p>{card.description}</p>
                                    //     {/* {card.stat && <span className="card-stat">{card.stat}</span>} */}
                                    // </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

// Need to import icons used above if not already imported
import { FiCreditCard, FiLogIn, FiLogOut, FiNavigation, FiTool } from 'react-icons/fi';

export default ManagerDashboard; // Renamed component for clarity

// --- END OF FILE ManagerDash.js ---