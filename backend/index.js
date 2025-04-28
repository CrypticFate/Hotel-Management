const express = require("express");
const cors = require("cors");
const AdminHotel = require("./routes/adminRoutes/adminHotelRoutes.js");
const app = express();

app.use(cors());
app.use(express.json());
app.use(AdminHotel);

app.listen(3001, () => {
    console.log("Server is running on port 3001");
});
