// require("dotenv").config();
const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser");
const fetchinstitute = require("../middleware/fetchInstitute");
const fetchadmin = require("../middleware/fetchAdmin");
const DonationRequest = require("../models/DonationRequests");
const { Admin, User, Institute } = require("../models/User");

async function updateCollectedItems(donationRequest) {
  // Sort items by total price (ascending)
  const sortedItems = donationRequest.items.sort((a, b) => a.total - b.total);

  let received = donationRequest.amountReceived;

  for (let item of sortedItems) {
    if (received >= item.total) {
      item.status = "collected"; // ✅ mark as collected
      received -= item.total;
    } else {
      item.status = item.status === "collected" ? "collected" : "pending";
      break;
    }
  }
}

// ---------------------- USER PAYS OR DONATES ----------------------
router.post("/pay/:instiId", fetchuser, async (req, res) => {
  try {
    const { amount, type, transactionId, donationRequestId,fee } = req.body;
    const instiId = req.params.instiId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    if (!["payment", "Donation"].includes(type)) {
      return res.status(400).json({ error: "Invalid transaction type" });
    }

    const institute = await Institute.findById(instiId);
    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // -----------------------------
    // ✅ Build transaction object
    // -----------------------------
    const transaction = {
      type,
      from: user.userName,
      to: institute.userName,
      transactionId,
      fee,
      amount,
      status: "accepted",
      date: new Date(),
    };

    // ✅ Add donationRequestId only for Donation
    if (type === "Donation") {
      if (!donationRequestId) {
        return res
          .status(400)
          .json({ error: "donationRequestId is required for donations" });
      }
      transaction.donationRequestId = donationRequestId;
    }

    // -----------------------------
    // ✅ Update institute wallet
    // -----------------------------
    institute.wallet.balance += amount;
    institute.wallet.totalReceived += amount;
    institute.wallet.transactions.push(transaction);

    // -----------------------------
    // ✅ Update user transactions
    // -----------------------------
    user.transactions.push(transaction);

    // -----------------------------
    // ✅ Update donation request
    // -----------------------------
    if (type === "Donation") {
      const donationReq = await DonationRequest.findById(donationRequestId);
      if (!donationReq) {
        return res.status(404).json({ error: "Donation request not found" });
      }

      donationReq.amountReceived += amount;

      if (typeof updateCollectedItems === "function") {
        await updateCollectedItems(donationReq);
      }

      await donationReq.save();
    }

    await institute.save();
    await user.save();

    res.json({
      success: true,
      message:
        type === "Donation" ? "Donation successful" : "Payment successful",
      transaction,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- INSTITUTE REQUESTS WITHDRAW ----------------
router.post("/withdraw", fetchinstitute, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    const institute = await Institute.findById(req.institute.id);
    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }

    const admin = await Admin.findOne(); // if single admin system
    if (!admin) {
      return res.status(500).json({ error: "No admin found" });
    }

    // Add a pending withdraw transaction
    institute.wallet.transactions.push({
      type: "withdraw",
      amount,
      status: "pending",
    });

    await institute.save();

    admin.withdrawRequests.push({
      institute: institute._id,
      amount,
      status: "pending",
    });
    await admin.save();
    res.json({ success: true, message: "Withdraw request submitted" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// -------------------- ADMIN GET ALL WITHDRAW REQUESTS --------------------
router.get("/withdraw-requests", fetchadmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).populate(
      "withdrawRequests.institute",
      "userName email"
    );
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.json(admin.withdrawRequests);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- ADMIN REVIEWS WITHDRAW ----------------
router.put("/withdraw-requests/:requestId", fetchadmin, async (req, res) => {
  try {
    const { status } = req.body; // accepted / cancelled / pending
    const { requestId } = req.params;

    const admin = await Admin.findOne(); // if single admin system
    if (!admin) {
      return res.status(500).json({ error: "No admin found" });
    }

    const request = admin.withdrawRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    request.status = status;
    await admin.save();

    if (status === "accepted") {
      const institute = await Institute.findById(request.institute);
      if (institute) {
        institute.wallet.balance -= request.amount;
        institute.wallet.totalWithdrawn += request.amount;

        // update transaction inside wallet
        const txn = institute.wallet.transactions.find(
          (t) =>
            t.type === "withdraw" &&
            t.amount === request.amount &&
            t.status === "pending"
        );
        if (txn) txn.status = "accepted";

        await institute.save();
      }
    }

    if (status === "cancelled") {
      const institute = await Institute.findById(request.institute);
      if (institute) {
        const txn = institute.wallet.transactions.find(
          (t) =>
            t.type === "withdraw" &&
            t.amount === request.amount &&
            t.status === "pending"
        );
        if (txn) txn.status = "cancelled";

        await institute.save();
      }
    }

    res.json({ success: true, message: `Withdraw request ${status}` });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- VIEW INSTITUTE WALLET ----------------
router.get("/institute-wallet/:instiId", async (req, res) => {
  try {
    const institute = await Institute.findById(req.params.instiId);
    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }

    res.json({
      balance: institute.wallet.balance,
      totalReceived: institute.wallet.totalReceived,
      totalWithdrawn: institute.wallet.totalWithdrawn,
      transactions: institute.wallet.transactions,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

module.exports = router;
