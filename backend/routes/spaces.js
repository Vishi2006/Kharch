const express = require('express');
const router = express.Router();
const Space = require('../models/Space');
const Transaction = require('../models/Transaction');
const ExpenseTitle = require('../models/ExpenseTitle');
const MonthlySummary = require('../models/MonthlySummary');
const { protect } = require('../middleware/auth');

// @route   GET /api/spaces
// @desc    Get all spaces for current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const spaces = await Space.find({ userId: req.user._id }).sort({ createdAt: 1 });
    res.json(spaces);
  } catch (error) {
    console.error('Error fetching spaces:', error.message);
    res.status(500).json({ message: 'Server error fetching spaces' });
  }
});

// @route   POST /api/spaces
// @desc    Create a new space
// @access  Private
router.post('/', protect, async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Space name is required' });
  }

  try {
    const trimmedName = name.trim();
    
    // Check if space with this name already exists for this user
    const existingSpace = await Space.findOne({ userId: req.user._id, name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    if (existingSpace) {
      return res.status(400).json({ message: 'A space with this name already exists' });
    }

    const space = new Space({
      userId: req.user._id,
      name: trimmedName,
      isDefault: false,
    });

    await space.save();
    res.status(201).json(space);
  } catch (error) {
    console.error('Error creating space:', error.message);
    res.status(500).json({ message: 'Server error creating space' });
  }
});

// @route   PUT /api/spaces/:id
// @desc    Update space details / Set as default
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { name, isDefault } = req.body;

  try {
    let space = await Space.findOne({ _id: req.params.id, userId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      // Verify name is not duplicate
      const duplicate = await Space.findOne({
        _id: { $ne: space._id },
        userId: req.user._id,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (duplicate) {
        return res.status(400).json({ message: 'Another space with this name already exists' });
      }
      space.name = trimmedName;
    }

    if (isDefault === true && !space.isDefault) {
      // Unset previous default spaces
      await Space.updateMany({ userId: req.user._id }, { isDefault: false });
      space.isDefault = true;
    }

    await space.save();
    res.json(space);
  } catch (error) {
    console.error('Error updating space:', error.message);
    res.status(500).json({ message: 'Server error updating space' });
  }
});

// @route   DELETE /api/spaces/:id
// @desc    Delete a space and all its associated data (Cascade delete)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const space = await Space.findOne({ _id: req.params.id, userId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    if (space.isDefault) {
      return res.status(400).json({ message: 'Cannot delete your default space. Set another space as default first.' });
    }

    // Double check we have at least one other space remaining
    const totalSpaces = await Space.countDocuments({ userId: req.user._id });
    if (totalSpaces <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only remaining space.' });
    }

    // Cascade delete transactions, titles, and summaries associated with this space
    await Transaction.deleteMany({ spaceId: space._id });
    await ExpenseTitle.deleteMany({ spaceId: space._id });
    await MonthlySummary.deleteMany({ spaceId: space._id });
    
    // Delete space itself
    await space.deleteOne();

    res.json({ message: 'Space and all associated history successfully deleted' });
  } catch (error) {
    console.error('Error deleting space:', error.message);
    res.status(500).json({ message: 'Server error deleting space' });
  }
});

module.exports = router;
