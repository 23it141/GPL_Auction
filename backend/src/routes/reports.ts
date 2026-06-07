import { Router } from 'express';
import Player from '../models/Player';
import Team from '../models/Team';
import Bid from '../models/Bid';
import AuditLog from '../models/AuditLog';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get full summary of auction stats (Total spent, players sold, etc.)
router.get('/summary', authenticateToken, async (req, res): Promise<any> => {
  try {
    const totalTeams = await Team.countDocuments();
    const totalPlayers = await Player.countDocuments();
    const soldPlayers = await Player.countDocuments({ soldStatus: 'sold' });
    const unsoldPlayers = await Player.countDocuments({ soldStatus: 'unsold' });
    
    // Total spent
    const spentStats = await Team.aggregate([
      {
        $group: {
          _id: null,
          totalInitial: { $sum: '$initialPurse' },
          totalRemaining: { $sum: '$remainingPurse' },
        },
      },
    ]);

    const totalInitialPurse = spentStats[0]?.totalInitial || 0;
    const totalRemainingPurse = spentStats[0]?.totalRemaining || 0;
    const totalSpentValue = totalInitialPurse - totalRemainingPurse;

    // Total bids count
    const totalBidsCount = await Bid.countDocuments();

    return res.json({
      totalTeams,
      totalPlayers,
      soldPlayers,
      unsoldPlayers,
      totalInitialPurse,
      totalRemainingPurse,
      totalSpentValue,
      totalBidsCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error compiling summary statistics' });
  }
});

// Sold Players Report
router.get('/sold', authenticateToken, async (req, res): Promise<any> => {
  try {
    const players = await Player.find({ soldStatus: 'sold' })
      .populate('soldTo', 'teamName teamCode')
      .sort({ soldPrice: -1 });
    return res.json(players);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching sold players report' });
  }
});

// Unsold Players Report
router.get('/unsold', authenticateToken, async (req, res): Promise<any> => {
  try {
    const players = await Player.find({ soldStatus: 'unsold' }).sort({ basePrice: -1 });
    return res.json(players);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching unsold players report' });
  }
});

// Team Spending Report
router.get('/spending', authenticateToken, async (req, res): Promise<any> => {
  try {
    const teams = await Team.find().sort({ teamName: 1 });
    const spendingData = teams.map(t => {
      const spent = t.initialPurse - t.remainingPurse;
      return {
        teamId: t._id,
        teamName: t.teamName,
        teamCode: t.teamCode,
        initialPurse: t.initialPurse,
        remainingPurse: t.remainingPurse,
        spentAmount: spent,
        squadSize: t.squadSize,
        spendingPercentage: t.initialPurse > 0 ? (spent / t.initialPurse) * 100 : 0
      };
    });
    return res.json(spendingData);
  } catch (error) {
    return res.status(500).json({ message: 'Error generating spending metrics' });
  }
});

// Full Squad Details Report
router.get('/squads', authenticateToken, async (req, res): Promise<any> => {
  try {
    const teams = await Team.find().sort({ teamName: 1 });
    const squadsReport = [];

    for (const team of teams) {
      const players = await Player.find({ soldTo: team._id, soldStatus: 'sold' }).sort({ soldPrice: -1 });
      squadsReport.push({
        teamId: team._id,
        teamName: team.teamName,
        teamCode: team.teamCode,
        captainName: team.captainName,
        remainingPurse: team.remainingPurse,
        squadSize: team.squadSize,
        players: players.map(p => ({
          playerName: p.playerName,
          role: p.role,
          age: p.age,
          basePrice: p.basePrice,
          soldPrice: p.soldPrice,
        }))
      });
    }

    return res.json(squadsReport);
  } catch (error) {
    return res.status(500).json({ message: 'Error creating squad structure report' });
  }
});

// Audit Log Report (Admin check history)
router.get('/logs', authenticateToken, async (req, res): Promise<any> => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving audit logs' });
  }
});

export default router;
