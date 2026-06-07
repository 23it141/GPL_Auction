import { Router, Response } from 'express';
import Team from '../models/Team';
import Player from '../models/Player';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import AuditLog from '../models/AuditLog';

const router = Router();

// Get all teams (Accessible to both admin and captains to see standings)
router.get('/', authenticateToken, async (req, res): Promise<any> => {
  try {
    const teams = await Team.find().sort({ teamName: 1 });
    return res.json(teams);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching teams' });
  }
});

// Create a team (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { teamName, captainName, mobileNumber, logo, initialPurse, teamCode, pin } = req.body;

  if (!teamName || !captainName || !mobileNumber) {
    return res.status(400).json({ message: 'Team Name, Captain Name, and Mobile Number are required' });
  }

  // Auto-generate code and PIN if not provided
  const finalCode = teamCode ? teamCode.toUpperCase().trim() : teamName.slice(0, 3).toUpperCase();
  const finalPin = pin || Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit PIN
  const purse = initialPurse ? Number(initialPurse) : 100000000;

  try {
    // Check for duplicate teamName or teamCode
    const existingTeam = await Team.findOne({
      $or: [{ teamName }, { teamCode: finalCode }],
    });

    if (existingTeam) {
      return res.status(400).json({ message: 'Team Name or Team Code already exists' });
    }

    const team = new Team({
      teamName: teamName.trim(),
      captainName: captainName.trim(),
      mobileNumber,
      logo: logo || '',
      initialPurse: purse,
      remainingPurse: purse,
      teamCode: finalCode,
      pin: finalPin,
    });

    await team.save();

    await AuditLog.create({
      action: 'ADD_TEAM',
      details: `Added new team ${team.teamName} with code ${team.teamCode}`,
      performedBy: 'ADMIN'
    });

    return res.status(201).json(team);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating team' });
  }
});

// Update a team (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { teamName, captainName, mobileNumber, logo, initialPurse, teamCode, pin } = req.body;
  const { id } = req.params;

  try {
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (teamCode) {
      const finalCode = teamCode.toUpperCase().trim();
      const existingTeam = await Team.findOne({ teamCode: finalCode, _id: { $ne: id } });
      if (existingTeam) {
        return res.status(400).json({ message: 'Team Code is already in use by another team' });
      }
      team.teamCode = finalCode;
    }

    if (teamName) {
      const existingTeam = await Team.findOne({ teamName: teamName.trim(), _id: { $ne: id } });
      if (existingTeam) {
        return res.status(400).json({ message: 'Team Name is already in use by another team' });
      }
      team.teamName = teamName.trim();
    }

    if (captainName) team.captainName = captainName.trim();
    if (mobileNumber) team.mobileNumber = mobileNumber;
    if (logo !== undefined) team.logo = logo;
    if (pin) team.pin = pin;

    if (initialPurse !== undefined) {
      // Recalculate remaining purse: remaining = newInitial - spent
      const spent = team.initialPurse - team.remainingPurse;
      team.initialPurse = Number(initialPurse);
      team.remainingPurse = Math.max(0, Number(initialPurse) - spent);
    }

    await team.save();

    await AuditLog.create({
      action: 'EDIT_TEAM',
      details: `Updated team details for ${team.teamName} (${team.teamCode})`,
      performedBy: 'ADMIN'
    });

    return res.json(team);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating team' });
  }
});

// Delete a team (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { id } = req.params;

  try {
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Reset all players sold to this team back to waiting status
    await Player.updateMany(
      { soldTo: id },
      { soldStatus: 'waiting', soldPrice: null, soldTo: null }
    );

    await Team.findByIdAndDelete(id);

    await AuditLog.create({
      action: 'DELETE_TEAM',
      details: `Deleted team ${team.teamName} (${team.teamCode})`,
      performedBy: 'ADMIN'
    });

    return res.json({ message: `Team ${team.teamName} deleted successfully. Associated players have been reset.` });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting team' });
  }
});

// Get team squad players (Accessible to anyone authenticated)
router.get('/:id/squad', authenticateToken, async (req, res): Promise<any> => {
  const { id } = req.params;
  try {
    const players = await Player.find({ soldTo: id, soldStatus: 'sold' }).sort({ soldPrice: -1 });
    return res.json(players);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching team squad' });
  }
});

export default router;
