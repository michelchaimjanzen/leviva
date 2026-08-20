import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect, superAdminOnly, AuthRequest } from '../middleware/authMiddleware.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const isFirstUser = (await User.countDocuments({})) === 0;

    await User.create({
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

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (user.status !== 'approved') {
      res.status(403).json({ message: 'Account is still pending approval.' });
      return;
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ _id: user._id, name: user.name, role: user.role, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/pending', protect, superAdminOnly, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }).select('-password');
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/approve/:id', protect, superAdminOnly, async (req: AuthRequest, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    res.json({ message: 'Lab member approved!', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;