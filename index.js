require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path"); // Needed for Vercel folder routing

const app = express();
const JWT_SECRET = "cinevault_super_secret_key_999";

app.use(express.json());

// --- THE VERCEL FIX: BULLETPROOF PATHING ---
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
});
// ------------------------------------------

// --- CONNECT TO MONGODB ---
const dbURI = process.env.MONGODB_URI;

mongoose.connect(dbURI)
    .then(() => console.log("✅ Successfully connected to MongoDB Atlas!"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));


// --- DEFINE DATABASE SCHEMAS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema, "users_24bai1193");

const bookingSchema = new mongoose.Schema({
    username: String, 
    movieId: Number,
    seats: String,
    showTime: String,
    totalPaid: String,
    bookingDate: { type: Date, default: Date.now }
});
const Booking = mongoose.model("Booking", bookingSchema, "bookings_24bai1193");

const reviewSchema = new mongoose.Schema({
    username: String, 
    movieId: Number,
    review: String,
    rating: String,
    characterArcs: String,
    cinematography: String,
    dateAdded: { type: Date, default: Date.now }
});
const Review = mongoose.model("Review", reviewSchema, "reviews_24bai1193");


// --- AUTHENTICATION ROUTES ---
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: "Username already taken!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        
        res.json({ message: "Account created successfully! You can now log in." });
    } catch (err) {
        res.status(500).json({ error: "Server error during registration." });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: "User not found!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid password!" });

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "2h" });
        
        res.json({ message: "Login successful!", token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Server error during login." });
    }
});

// --- DATA ROUTES ---
app.post("/book", async (req, res) => {
    try {
        const newBooking = new Booking(req.body);
        await newBooking.save(); 
        res.json({ message: "Success! Booking saved securely to MongoDB." });
    } catch (err) {
        res.status(500).json({ error: "Failed to save booking." });
    }
});

app.post("/review", async (req, res) => {
    try {
        const newReview = new Review(req.body);
        await newReview.save(); 
        res.json({ message: "Success! Deep analysis review saved permanently." });
    } catch (err) {
        res.status(500).json({ error: "Failed to save review." });
    }
});

// --- EXPORT FOR VERCEL ---
module.exports = app;