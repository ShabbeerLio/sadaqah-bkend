const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const fetchuser = require("../middleware/fetchUser");
const fetchinstitute = require("../middleware/fetchInstitute");
const { User } = require("../models/User");
const fetchadmin = require("../middleware/fetchAdmin");

// POST /api/posts/create
router.post("/create", fetchinstitute, async (req, res) => {
  try {
    const { type, location, title, description, image } = req.body;

    const post = new Post({
      institute: req.institute.id, // ✅ institute only
      type,
      location,
      title,
      description,
      image,
    });

    const savedPost = await post.save();
    res.json({ success: true, post: savedPost });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/posts/like/:id
router.put("/like/:id", fetchuser, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    const alreadyLiked = post.likes.some(
      (like) => like.toString() === req.user.id
    );

    if (alreadyLiked) {
      post.likes.pull(req.user.id); // unlike
    } else {
      post.likes.push(req.user.id); // like
    }

    await post.save();
    res.json({ success: true, likes: post.likes.length });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/posts/comment/:id
router.post("/comment/:id", fetchuser, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = {
      user: req.user.id, // ❌ if req.user is undefined → crash
      text: req.body.text,
    };

    post.comments.push(comment);
    await post.save();

    res.json({ success: true, comments: post.comments });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// POST /api/posts/share/:id
router.post("/share/:id", fetchuser, async (req, res) => {
  try {
    const { platform } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    const share = {
      user: req.user.id,
      platform: platform || "copyLink",
    };

    post.shares.push(share);
    await post.save();

    res.json({ success: true, shares: post.shares.length });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ------------------------------------------------
// PUBLIC ROUTES
// ------------------------------------------------

// GET /api/posts/all
router.get("/all", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("institute", "username avatar email")
      .populate("comments.user", "userName avatar");
    res.json(posts);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/posts/edit/:id (Institute only)
router.put("/edit/:id", fetchinstitute, async (req, res) => {
  try {
    const { title, description, image, type, location } = req.body;

    let post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    // check ownership
    if (post.institute.toString() !== req.institute.id) {
      return res.status(403).json({ success: false, msg: "Not authorized" });
    }

    post = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: { title, description, image, type, location } },
      { new: true }
    );

    res.json({ success: true, post });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// DELETE /api/posts/delete/:id (Institute only)
router.delete("/delete/:id", fetchinstitute, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    if (post.institute.toString() !== req.institute.id) {
      return res.status(403).json({ success: false, msg: "Not authorized" });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, msg: "Post deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// PUT /api/posts/deactivate/:id (Institute can deactivate)
router.put("/deactivate/:id", fetchinstitute, async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    if (post.institute.toString() !== req.institute.id) {
      return res.status(403).json({ success: false, msg: "Not authorized" });
    }

    post.status = "inactive";
    await post.save();
    res.json({ success: true, post });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});
// PUT /api/posts/activate/:id (Institute can deactivate)
router.put("/activate/:id", fetchinstitute, async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    if (post.institute.toString() !== req.institute.id) {
      return res.status(403).json({ success: false, msg: "Not authorized" });
    }

    post.status = "active";
    await post.save();
    res.json({ success: true, post });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// ✅ PUT /api/posts/block/:id
router.put("/block/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // make sure blockedPosts is initialized
    if (!Array.isArray(user.blockedPosts)) {
      user.blockedPosts = [];
    }

    if (!user.blockedPosts.includes(req.params.id)) {
      user.blockedPosts.push(req.params.id);
      await user.save();
    }

    res.json({ success: true, msg: "Post blocked for this user only" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ✅ PUT /api/posts/unblock/:id
router.put("/unblock/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (!Array.isArray(user.blockedPosts)) {
      user.blockedPosts = [];
    }

    user.blockedPosts = user.blockedPosts.filter(
      (postId) => postId.toString() !== req.params.id
    );

    await user.save();

    res.json({ success: true, msg: "Post unblocked for this user only" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/posts/admin/deactivate/:id
router.put("/admin/deactivate/:id", fetchadmin, async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    post.status = "inactive";
    await post.save();
    res.json({ success: true, msg: "Post deactivated by admin" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

// PUT /api/posts/admin/activate/:id
router.put("/admin/activate/:id", fetchadmin, async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    post.status = "active";
    await post.save();
    res.json({ success: true, msg: "Post activated by admin" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
});

module.exports = router;
