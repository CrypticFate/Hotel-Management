const express = require("express");
const router = express.Router();
const db = require("../../dbconn");
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

module.exports = router;
