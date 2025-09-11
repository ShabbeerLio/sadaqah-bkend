const DonationRequest = require("../models/DonationRequests");

async function autoCancelItems() {
    console.log("running corn job")
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const donationRequests = await DonationRequest.find({
    "items.status": { $in: ["taken", "awaited"] },
    "items.takenAt": { $lte: sevenDaysAgo },
  });

  for (let req of donationRequests) {
    req.items.forEach((item) => {
      if (
        ["taken", "awaited"].includes(item.status) &&
        item.takenAt <= sevenDaysAgo
      ) {
        item.status = "pending"; // ✅ auto revert
        item.takenAt = null;
      }
    });
    await req.save();
  }
}

module.exports = autoCancelItems;
