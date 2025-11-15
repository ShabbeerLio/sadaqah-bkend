const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser");
const { User, Institute } = require("../models/User");
const fetchinstitute = require("../middleware/fetchInstitute");

// ---------------- FOLLOW -------------------
// User follows an institute
router.post("/follow/:id", fetchuser, async (req, res) => {
  try {
    const instituteId = req.params.id;
    const user = await User.findById(req.user.id);
    const institute = await Institute.findById(instituteId);

    if (!institute) {
      return res.status(404).json({ error: "Institute not found" });
    }

    if (!user.followingInstitutes) user.followingInstitutes = [];
    if (!institute.followers) institute.followers = [];

    if (user.followingInstitutes.includes(instituteId)) {
      return res
        .status(400)
        .json({ error: "Already following this institute" });
    }

    user.followingInstitutes.push(instituteId);
    institute.followers.push(user._id);

    await user.save();
    await institute.save();

    res.json({ success: true, message: "You are now following the institute" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- UNFOLLOW -------------------
// User unfollows an institute
router.post("/unfollow/:instituteId", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const instituteId = req.params.instituteId;

    const user = await User.findById(userId);
    const institute = await Institute.findById(instituteId);

    if (!institute) {
      return res
        .status(404)
        .json({ success: false, message: "Institute not found" });
    }

    // Remove from following
    user.followingInstitutes = user.followingInstitutes.filter(
      (id) => id.toString() !== instituteId
    );
    await user.save();

    // Remove from followers
    institute.followers = institute.followers.filter(
      (id) => id.toString() !== userId
    );
    await institute.save();

    res.json({ success: true, message: "Unfollowed institute successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- GET USER FOLLOWING -------------------
router.get("/my-following", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "followingInstitutes",
      "userName email instituteType"
    );
    res.json({ success: true, following: user.followingInstitutes });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- GET INSTITUTE FOLLOWERS -------------------
router.get("/institute-followers/:id", async (req, res) => {
  try {
    const institute = await Institute.findById(req.params.id).populate(
      "followers",
      "userName email"
    );
    if (!institute) {
      return res
        .status(404)
        .json({ success: false, message: "Institute not found" });
    }
    res.json({ success: true, followers: institute.followers });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ---------------- INSTITUTE REMOVES FOLLOWER -------------------

// Institute removes a user from followers
router.post("/remove-follower/:userId", fetchinstitute, async (req, res) => {
  try {
    const instituteId = req.institute.id;
    const userId = req.params.userId;

    const institute = await Institute.findById(instituteId);
    const user = await User.findById(userId);

    if (!institute || !user) {
      return res
        .status(404)
        .json({ success: false, message: "Institute or User not found" });
    }

    // Check if user is actually a follower
    if (!institute.followers.includes(userId)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User is not a follower of this institute",
        });
    }

    // Remove user from institute's followers
    institute.followers = institute.followers.filter(
      (id) => id.toString() !== userId
    );
    await institute.save();

    // Remove institute from user's followingInstitutes
    user.followingInstitutes = user.followingInstitutes.filter(
      (id) => id.toString() !== instituteId
    );
    await user.save();

    res.json({ success: true, message: "User removed from followers" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

module.exports = router;
