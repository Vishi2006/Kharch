const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ExpenseTitle = require('../models/ExpenseTitle');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// Helper to normalize displayName (e.g. "bus trip" -> "Bus Trip")
const formatDisplayName = (name) => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// @route   GET /api/titles
// @desc    Search/List canonical titles in a space
// @access  Private
router.get('/', protect, async (req, res) => {
  const { spaceId, q } = req.query;

  if (!spaceId) {
    return res.status(400).json({ message: 'spaceId query parameter is required' });
  }

  try {
    const query = { spaceId, userId: req.user._id };
    
    if (q && q.trim()) {
      query.normalizedName = { $regex: q.trim().toLowerCase(), $options: 'i' };
    }

    const titles = await ExpenseTitle.find(query).limit(50).sort({ displayName: 1 });
    res.json(titles);
  } catch (error) {
    console.error('Error fetching titles:', error.message);
    res.status(500).json({ message: 'Server error fetching titles' });
  }
});

// @route   GET /api/titles/recent
// @desc    Get recently used titles in a space
// @access  Private
router.get('/recent', protect, async (req, res) => {
  const { spaceId } = req.query;

  if (!spaceId) {
    return res.status(400).json({ message: 'spaceId query parameter is required' });
  }

  try {
    // Aggregate transactions in this space to find the most recently used titleIds
    const recentTx = await Transaction.aggregate([
      { $match: { spaceId: new mongoose.Types.ObjectId(spaceId) } },
      { $sort: { date: -1 } },
      { $group: { _id: '$titleId', lastUsed: { $first: '$date' } } },
      { $sort: { lastUsed: -1 } },
      { $limit: 30 }
    ]);

    const titleIds = recentTx.map(tx => tx._id);
    
    // Fetch actual Title objects
    let titles = await ExpenseTitle.find({ _id: { $in: titleIds } });
    
    // Maintain aggregation order
    titles = titleIds.map(id => titles.find(t => t._id.toString() === id.toString())).filter(Boolean);

    // If we have fewer than 5 recent titles, fill with other general titles in the space
    if (titles.length < 5) {
      const existingIds = titles.map(t => t._id);
      const fills = await ExpenseTitle.find({ 
        spaceId, 
        userId: req.user._id,
        _id: { $nin: existingIds }
      }).limit(5 - titles.length);
      titles = [...titles, ...fills];
    }

    res.json(titles);
  } catch (error) {
    console.error('Error fetching recent titles:', error.message);
    res.status(500).json({ message: 'Server error fetching recent titles' });
  }
});

// @route   POST /api/titles
// @desc    Create or retrieve existing canonical title
// @access  Private
router.post('/', protect, async (req, res) => {
  const { spaceId, name } = req.body;

  if (!spaceId || !name || !name.trim()) {
    return res.status(400).json({ message: 'spaceId and name are required' });
  }

  try {
    const rawName = name.trim();
    const normalizedName = rawName.toLowerCase();
    
    // Check if it already exists
    let title = await ExpenseTitle.findOne({ spaceId, normalizedName });
    
    if (!title) {
      const displayName = formatDisplayName(rawName);
      title = new ExpenseTitle({
        userId: req.user._id,
        spaceId,
        normalizedName,
        displayName
      });
      await title.save();
    }

    res.status(201).json(title);
  } catch (error) {
    console.error('Error creating canonical title:', error.message);
    res.status(500).json({ message: 'Server error creating title' });
  }
});

module.exports = router;
