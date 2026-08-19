import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import TestConfig from '../models/TestConfig.js';
import PatientResult from '../models/PatientResult.js';
import TestSequence from '../models/TestSequence.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const clinicianOrAdmin = [requireAuth(), requireRole(['clinician', 'lab_admin'])];
const adminOnly = [requireAuth(), requireRole(['lab_admin'])];

// --- TEST CONFIGURATION ROUTES ---

// Save a new test configuration created in the clinician workspace
// LAB ADMIN ONLY — building/editing core test templates is admin territory.
router.post('/tests', ...adminOnly, async (req, res) => {
  try {
    const newTest = new TestConfig(req.body);
    const savedTest = await newTest.save();
    res.status(201).json(savedTest);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Fetch all available test configurations for the dashboard
// CLINICIAN or LAB ADMIN — clinicians need to browse the bank to build sequences.
router.get('/tests', ...clinicianOrAdmin, async (req, res) => {
  try {
    const tests = await TestConfig.find().sort({ createdAt: -1 });
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch all sequences
// CLINICIAN or LAB ADMIN
router.get('/sequences', ...clinicianOrAdmin, async (req, res) => {
  try {
    const sequences = await TestSequence.find({});
    res.json(sequences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

// Update an existing test configuration by ID
// LAB ADMIN ONLY
router.put('/tests/:id', ...adminOnly, async (req, res) => {
  try {
    const updatedTest = await TestConfig.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // returns the updated document
    );
    res.json(updatedTest);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE a test
// LAB ADMIN ONLY
router.delete('/tests/:id', ...adminOnly, async (req, res) => {
  try {
    await TestConfig.findByIdAndDelete(req.params.id);
    res.json({ message: "Test deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Save a new Sequence (POST)
// LAB ADMIN ONLY
router.post('/sequences', ...adminOnly, async (req, res) => {
  try {
    const newSequence = new TestSequence(req.body);
    const savedSequence = await newSequence.save();
    res.status(201).json(savedSequence);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Fetch a specific Sequence by ID (GET)
// PUBLIC — this is exactly what the standalone /run/:id patient tunnel calls to load
// the sequence to run. Do NOT put requireAuth on this route.
// We use .populate('steps.testId') so it automatically fetches all the actual test data for the runner!
router.get('/sequences/:id', async (req, res) => {
  try {
    const sequence = await TestSequence.findById(req.params.id)
      .populate('steps.testId');

    if (!sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }
    res.json(sequence);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. UPDATE an existing Sequence (PUT) — supports the Sequence Builder's edit mode.
// LAB ADMIN ONLY
// Full-document replace of sequenceName/description/steps, same pattern as /tests/:id.
router.put('/sequences/:id', ...adminOnly, async (req, res) => {
  try {
    const updatedSequence = await TestSequence.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedSequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }
    res.json(updatedSequence);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE a sequence
// LAB ADMIN ONLY
router.delete('/sequences/:id', ...adminOnly, async (req, res) => {
  try {
    await TestSequence.findByIdAndDelete(req.params.id);
    res.json({ message: "Sequence deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PATIENT RESULT ROUTES ---

// SAVE a new master sequence result to the cloud
// PUBLIC — this is the final step of the patient tunnel, submitted with no login.
// Do NOT put requireAuth on this route.
router.post('/results', async (req, res) => {
  try {
    const { patientId, sequenceId, sequenceName, masterResults } = req.body;

    // Automatically extract all the test types from the results for Category 2 filtering
    const testTypesIncluded = masterResults
      .map((result: any) => result.data?.testType || 'Unknown')
      .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index); // Removes duplicates

    const newResult = new PatientResult({
      patientId,
      sequenceId,
      sequenceName,
      testTypesIncluded,
      masterResults
    });

    const savedResult = await newResult.save();
    res.status(201).json(savedResult);
  } catch (err: any) {
    console.error("Error saving patient result:", err);
    res.status(400).json({ error: err.message });
  }
});

// Fetch historical results for a specific test or patient
// CLINICIAN or LAB ADMIN — patient results are sensitive, never public.
router.get('/results', ...clinicianOrAdmin, async (req, res) => {
  try {
    const results = await PatientResult.find().populate('testId').sort({ sessionDate: -1 });
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;