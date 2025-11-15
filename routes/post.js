const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const fetchuser = require("../middleware/fetchUser");
const fetchinstitute = require("../middleware/fetchInstitute");
const { User } = require("../models/User");
const fetchadmin = require("../middleware/fetchAdmin");
var jwt = require("jsonwebtoken");
const JWT_SECRET = "SadaqahApp";
const { upload } = require("../utils/cloudinary");

// POST /api/posts/create
router.post(
  "/create",
  fetchinstitute,
  upload.array("images", 6),
  async (req, res) => {
    try {
      const { type, location, title, description } = req.body;
      const imageUrls = req.files?.map((file) => file.path) || [];

      const post = new Post({
        institute: req.institute.id, // ✅ institute only
        type,
        location,
        title,
        description,
        image: imageUrls,
      });

      const savedPost = await post.save();
      res.json({ success: true, post: savedPost });
    } catch (error) {
      console.error(error.message);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

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
router.post("/comment/:id", async (req, res) => {
  try {
    const token = req.header("auth-token");
    if (!token) {
      return res.status(401).json({ success: false, msg: "No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, msg: "Invalid token" });
    }

    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res
        .status(400)
        .json({ success: false, msg: "Comment cannot be empty" });
    }

    const post = await Post.findById(req.params.id);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    const comment = { text };

    // Determine whether it's a user or institute
    if (decoded.user) {
      comment.user = decoded.user.id;
    } else if (decoded.institute) {
      comment.institute = decoded.institute.id;
    } else {
      return res
        .status(401)
        .json({ success: false, msg: "Not authorized to comment" });
    }

    post.comments.push(comment);
    await post.save();

    // Populate for front-end
    await post.populate([
      { path: "comments.user", select: "userName avatar" },
      { path: "comments.institute", select: "userName avatar" },
    ]);

    res.json({ success: true, comments: post.comments });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, msg: "Internal server error" });
  }
});

// POST /api/posts/reply/:postId/:commentId
router.post("/reply/:postId/:commentId", async (req, res) => {
  try {
    const token = req.header("auth-token");
    if (!token) {
      return res.status(401).json({ success: false, msg: "No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, msg: "Invalid token" });
    }

    const { postId, commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === "")
      return res
        .status(400)
        .json({ success: false, msg: "Reply text cannot be empty" });

    const post = await Post.findById(postId);
    if (!post)
      return res.status(404).json({ success: false, msg: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment)
      return res.status(404).json({ success: false, msg: "Comment not found" });

    const reply = { text };
    if (decoded.user) reply.user = decoded.user.id;
    else if (decoded.institute) reply.institute = decoded.institute.id;
    else
      return res
        .status(401)
        .json({ success: false, msg: "Not authorized to reply" });

    comment.replies.push(reply);
    await post.save();

    // ✅ populate both comments and replies for user & institute
    await post.populate([
      { path: "comments.user", select: "userName avatar" },
      { path: "comments.institute", select: "userName avatar" },
      { path: "comments.replies.user", select: "userName avatar" },
      { path: "comments.replies.institute", select: "userName avatar" },
    ]);

    res.json({ success: true, replies: comment.replies });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
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

router.get("/all", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });

    // Populate post institute
    await Post.populate(posts, {
      path: "institute",
      select: "userName avatar email",
    });

    // Populate comments + replies for both user & institute
    await Post.populate(posts, [
      { path: "comments.user", select: "userName avatar" },
      { path: "comments.institute", select: "userName avatar" },
      { path: "comments.replies.user", select: "userName avatar" },
      { path: "comments.replies.institute", select: "userName avatar" }, // important!
    ]);

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/posts/edit/:id (Institute only)
router.put(
  "/edit/:id",
  fetchinstitute,
  upload.array("newImages", 6),
  async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post)
        return res.status(404).json({ success: false, msg: "Post not found" });

      if (post.institute.toString() !== req.institute.id)
        return res.status(403).json({ success: false, msg: "Not authorized" });

      // Remove deleted images
      const removedImages = req.body.removedImages || [];
      let updatedImages = post.image.filter(
        (img) => !removedImages.includes(img)
      );

      // Add newly uploaded images
      if (req.files && req.files.length > 0) {
        const newImagePaths = req.files.map((file) => file.path); // depends on your multer setup
        updatedImages = [...updatedImages, ...newImagePaths];
      }

      post.type = req.body.type || post.type;
      post.title = req.body.title || post.title;
      post.description = req.body.description || post.description;
      post.location = req.body.location || post.location;
      post.image = updatedImages;

      await post.save();

      res.json({ success: true, msg: "Post updated successfully", post });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
);

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

// GET /api/posts/:id
router.get("/:id", fetchinstitute, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Optional: Only allow owner institute to access
    if (post.institute.toString() !== req.institute.id) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    res.json({ success: true, post });
  } catch (error) {
    console.error("Error fetching post:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
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

// GET /api/posts/following
router.get("/following", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "followingInstitutes"
    );
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const instituteIds = user.followingInstitutes.map((inst) => inst._id);

    if (!instituteIds.length) {
      return res.json({ success: true, posts: [] });
    }

    // ✅ Fetch all posts (not just 1 per institute)
    const posts = await Post.find({ institute: { $in: instituteIds } })
      .populate("institute", "username avatar email")
      .populate("comments.user", "userName avatar")
      .sort({ createdAt: -1 });

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ✅ GET /api/posts/institute/:id
router.get("/institute/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const posts = await Post.find({ institute: id })
      .populate("institute", "username avatar email")
      .populate("comments.user", "userName avatar")
      .populate("comments.institute", "userName avatar")
      .populate("comments.replies.user", "userName avatar")
      .populate("comments.replies.institute", "userName avatar")
      .sort({ createdAt: -1 });

    if (!posts || posts.length === 0) {
      return res
        .status(404)
        .json({ success: false, msg: "No posts found for this institute" });
    }

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
