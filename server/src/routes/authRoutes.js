// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// 1. REGISTER (Lab members request access)
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // If it's the very first user ever, make them super_admin & approved automatically
    const isFirstUser = (await User.countDocuments({})) === 0;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: isFirstUser ? 'super_admin' : 'admin',
      status: isFirstUser ? 'approved' : 'pending'
    });

    res.status(201).json({ message: 'Registration requested successfully. Awaiting approval.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({ message: 'Account is still pending approval.' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ _id: user._id, name: user.name, role: user.role, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. GET PENDING LAB MEMBERS (Super Admin Only)
router.get('/pending', protect, superAdminOnly, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }).select('-password');
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. APPROVE LAB MEMBER (Super Admin Only)
router.patch('/approve/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    res.json({ message: 'Lab member approved!', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;