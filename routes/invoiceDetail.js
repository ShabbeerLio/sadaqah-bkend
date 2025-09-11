const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/fetchUser"); // Ensure user is authenticated
const sendEmail = require("../utils/sendEmail");

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Access denied. Admins only." });
  }
  next();
};

// Route: Add Invoice
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Create new invoice
    const newInvoice = {
      ...req.body,
      invoiceNumber: `INV-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`,
    };

    // ✅ Push the new invoice to the invoices array
    user.invoices.push(newInvoice);
    await user.save();

    // Send email
    const emailContent = `
      <h2>Invoice Generated</h2>
      <p>Dear ${user.name},</p>
      <p>Your invoice <strong>${newInvoice.invoiceNumber}</strong> has been generated successfully.</p>
      <p><strong>Subscription</strong></p>
      <p><strong>Plan:</strong> ${newInvoice.plan}</p>
      <p><strong>Price:</strong> ₹${newInvoice.price}</p>
      <p><strong>TransactionId:</strong> ₹${newInvoice.transactionId}</p>
      <p>Thank you!</p>
    `;
    await sendEmail(user.email, "Your Invoice Details", emailContent);

    res.status(201).json({
      success: true,
      message: "Invoice added successfully!",
      invoice: newInvoice,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" + error });
  }
});

// Route: Edit Invoice
router.put(
  "/edit/:invoiceId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const {
        type,
        plan,
        price,
        name,
        email,
        phone,
        address,
        pincode,
        city,
        state,
      } = req.body;

      // Find the user who has this invoice
      const user = await User.findOne({ "invoices._id": invoiceId });
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });

      // Update the invoice inside the user's invoices array
      const invoice = user.invoices.id(invoiceId);
      if (!invoice)
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });

      // Update fields
      invoice.type = type || invoice.type;
      invoice.plan = plan || invoice.plan;
      invoice.price = price || invoice.price;
      invoice.name = name || invoice.name;
      invoice.email = email || invoice.email;
      invoice.phone = phone || invoice.phone;
      invoice.address = address || invoice.address;
      invoice.pincode = pincode || invoice.pincode;
      invoice.city = city || invoice.city;
      invoice.state = state || invoice.state;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Invoice updated successfully!",
        invoice,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Route: Delete Invoice
router.delete(
  "/delete/:invoiceId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;

      // Find the user who has this invoice
      const user = await User.findOne({ "invoices._id": invoiceId });
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });

      // Remove the invoice from the user's invoices array
      user.invoices = user.invoices.filter(
        (inv) => inv._id.toString() !== invoiceId
      );
      await user.save();

      res
        .status(200)
        .json({ success: true, message: "Invoice deleted successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
