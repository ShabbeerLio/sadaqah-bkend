var jwt = require("jsonwebtoken");
const JWT_SECRET = "SadaqahApp";
const { Admin } = require("../models/User");

const fetchadmin = async (req, res, next) => {
  // get token from header
  const token = req.header("auth-token");
  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET);

    // if using separate Admin model
    const admin = await Admin.findById(data.admin.id);
    if (!admin) return res.status(403).json({ error: "Not authorized" });

    req.admin = admin;
    next();
  } catch (error) {
    console.error(error.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = fetchadmin;
