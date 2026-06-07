import { Router, Response } from 'express';
import Player from '../models/Player';
import Team from '../models/Team';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import AuditLog from '../models/AuditLog';

const router = Router();

// Get all players (Accessible to admin and captains)
router.get('/', authenticateToken, async (req, res): Promise<any> => {
  const { status, role, category, search } = req.query;
  const filter: any = {};

  if (status) filter.soldStatus = status;
  if (role) filter.role = role;
  if (category) filter.category = category;
  if (search) {
    filter.playerName = { $regex: search, $options: 'i' };
  }

  try {
    const players = await Player.find(filter)
      .populate('soldTo', 'teamName teamCode logo')
      .sort({ playerName: 1 });
    return res.json(players);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching players' });
  }
});

// Get a single player
router.get('/:id', authenticateToken, async (req, res): Promise<any> => {
  try {
    const player = await Player.findById(req.params.id).populate('soldTo', 'teamName teamCode');
    if (!player) return res.status(404).json({ message: 'Player not found' });
    return res.json(player);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching player details' });
  }
});

// Create player (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { playerName, photo, age, role, battingStyle, bowlingStyle, basePrice, category, description } = req.body;

  if (!playerName || !age || !role || !basePrice) {
    return res.status(400).json({ message: 'Player Name, Age, Role, and Base Price are required' });
  }

  try {
    const player = new Player({
      playerName: playerName.trim(),
      photo: photo || '',
      age: Number(age),
      role,
      battingStyle: battingStyle || '',
      bowlingStyle: bowlingStyle || '',
      basePrice: Number(basePrice),
      category: category || 'Uncapped',
      description: description || '',
      soldStatus: 'waiting',
    });

    await player.save();

    await AuditLog.create({
      action: 'ADD_PLAYER',
      details: `Added player ${player.playerName} (Base Price: ${player.basePrice})`,
      performedBy: 'ADMIN'
    });

    return res.status(201).json(player);
  } catch (error) {
    return res.status(500).json({ message: 'Error creating player' });
  }
});

// Update player details (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const player = await Player.findById(id);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    // Handle soldTo and status changes manually if they are being updated via form
    // Note: Main auction state transitions are handled by the Socket.IO controller,
    // but this lets administrators edit attributes directly.
    Object.assign(player, updateData);
    await player.save();

    await AuditLog.create({
      action: 'EDIT_PLAYER',
      details: `Modified player specifications for ${player.playerName}`,
      performedBy: 'ADMIN'
    });

    return res.json(player);
  } catch (error) {
    return res.status(500).json({ message: 'Error updating player' });
  }
});

// Delete player (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { id } = req.params;

  try {
    const player = await Player.findById(id);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    // If player was sold, update the team purse
    if (player.soldStatus === 'sold' && player.soldTo && player.soldPrice) {
      await Team.findByIdAndUpdate(player.soldTo, {
        $inc: { remainingPurse: player.soldPrice, squadSize: -1 }
      });
    }

    await Player.findByIdAndDelete(id);

    await AuditLog.create({
      action: 'DELETE_PLAYER',
      details: `Deleted player ${player.playerName}`,
      performedBy: 'ADMIN'
    });

    return res.json({ message: `Player ${player.playerName} deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting player' });
  }
});

// Bulk Import Players (Admin only)
router.post('/import', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  const { players } = req.body; // Expecting an array of player objects

  if (!players || !Array.isArray(players)) {
    return res.status(400).json({ message: 'Invalid bulk import data. Expecing an array of players.' });
  }

  try {
    const sanitizedPlayers = players.map(p => ({
      playerName: p.playerName,
      photo: p.photo || '',
      age: Number(p.age) || 25,
      role: p.role || 'Batsman',
      battingStyle: p.battingStyle || 'Right-hand bat',
      bowlingStyle: p.bowlingStyle || 'Right-arm medium',
      basePrice: Number(p.basePrice) || 2000000,
      category: p.category || 'Uncapped',
      description: p.description || '',
      soldStatus: 'waiting',
    }));

    const result = await Player.insertMany(sanitizedPlayers);

    await AuditLog.create({
      action: 'BULK_IMPORT',
      details: `Imported ${result.length} players via custom JSON file`,
      performedBy: 'ADMIN'
    });

    return res.status(201).json({ message: `Successfully imported ${result.length} players`, count: result.length });
  } catch (error) {
    return res.status(500).json({ message: 'Error during bulk player import' });
  }
});

// Seed mock players (Admin only)
router.post('/import/mock', authenticateToken, requireAdmin, async (req, res): Promise<any> => {
  try {
    const count = await Player.countDocuments();
    if (count > 0) {
      // Clean first if admin requests, or simply add new ones.
      // For testing convenience, we will wipe existing players and teams squads when this is hit
      await Player.deleteMany({});
      await Team.updateMany({}, { remainingPurse: '$initialPurse', squadSize: 0 });
    }

    const mockPlayers = [
      // Category A
      { playerName: 'Virat Kohli', age: 37, role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 2000, category: 'A', description: 'Legendary Indian top-order batsman and master chaser.' },
      { playerName: 'Jasprit Bumrah', age: 32, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast', basePrice: 2000, category: 'A', description: 'Unorthodox action, deadly yorkers, arguably the best multi-format bowler.' },
      { playerName: 'MS Dhoni', age: 44, role: 'Wicket-Keeper', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 2000, category: 'A', description: 'Cool captain, finisher, and elite wicketkeeper.' },
      { playerName: 'Rohit Sharma', age: 39, role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 2000, category: 'A', description: 'Hitman, multiple IPL winning captain, elegant opener.' },
      { playerName: 'Rashid Khan', age: 27, role: 'All-Rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm legbreak', basePrice: 2000, category: 'A', description: 'Global T20 sensation, quick leg-spinner, and powerful hitter.' },
      { playerName: 'Glenn Maxwell', age: 37, role: 'All-Rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 1500, category: 'A', description: 'Big Show, explosive middle order bat, handy spinner.' },
      { playerName: 'Heinrich Klaasen', age: 34, role: 'Wicket-Keeper', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 1500, category: 'A', description: 'Incredible hitter of spin, middle-order specialist.' },
      { playerName: 'Mitchell Starc', age: 36, role: 'Bowler', battingStyle: 'Left-hand bat', bowlingStyle: 'Left-arm fast', basePrice: 2000, category: 'A', description: 'Left-arm speedster, elite new-ball and death bowler.' },
      
      // Category B
      { playerName: 'Shubman Gill', age: 26, role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 1000, category: 'B', description: 'Elegant young opener, next-gen superstar.' },
      { playerName: 'Suryakumar Yadav', age: 35, role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 1500, category: 'B', description: 'Mr. 360, explosive batsman in short format.' },
      { playerName: 'Travis Head', age: 32, role: 'Batsman', battingStyle: 'Left-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 1500, category: 'B', description: 'Fearless Australian opener, big match player.' },
      { playerName: 'Rinku Singh', age: 28, role: 'Batsman', battingStyle: 'Left-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 750, category: 'B', description: 'Elite death-overs finisher.' },
      { playerName: 'Yashasvi Jaiswal', age: 24, role: 'Batsman', battingStyle: 'Left-hand bat', bowlingStyle: 'Right-arm legbreak', basePrice: 1000, category: 'B', description: 'Dynamic left-handed opener with excellent strokeplay.' },
      { playerName: 'Yuzvendra Chahal', age: 35, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm legbreak', basePrice: 1000, category: 'B', description: 'IPL\'s leading wicket taker, clever leg spinner.' },
      { playerName: 'Mohammed Shami', age: 35, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast-medium', basePrice: 1500, category: 'B', description: 'Seam presentation specialist, wicket-taking bowler.' },
      { playerName: 'Trent Boult', age: 36, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Left-arm fast-medium', basePrice: 1500, category: 'B', description: 'First-over wicket specialist.' },
      { playerName: 'Pat Cummins', age: 33, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast', basePrice: 2000, category: 'B', description: 'World-class pace bowler and inspirational leader.' },
      { playerName: 'Kagiso Rabada', age: 31, role: 'Bowler', battingStyle: 'Left-hand bat', bowlingStyle: 'Right-arm fast', basePrice: 1500, category: 'B', description: 'South African speed merchant, highly effective at death.' },
 
      // Category C
      { playerName: 'Hardik Pandya', age: 32, role: 'All-Rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast-medium', basePrice: 2000, category: 'C', description: 'Premier Indian seam-bowling all-rounder.' },
      { playerName: 'Ravindra Jadeja', age: 37, role: 'All-Rounder', battingStyle: 'Left-hand bat', bowlingStyle: 'Slow left-arm orthodox', basePrice: 1500, category: 'C', description: 'Three-dimensional superstar, gun fielder, tight bowling, clutch batting.' },
      { playerName: 'Axar Patel', age: 32, role: 'All-Rounder', battingStyle: 'Left-hand bat', bowlingStyle: 'Slow left-arm orthodox', basePrice: 1000, category: 'C', description: 'Reliable utility cricketer, solid lower-middle order bat.' },
      { playerName: 'Marcus Stoinis', age: 36, role: 'All-Rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium-fast', basePrice: 1000, category: 'C', description: 'Powerful middle-order batsman and useful medium-pacer.' },
      { playerName: 'Andre Russell', age: 38, role: 'All-Rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast', basePrice: 1500, category: 'C', description: 'Dre Russ, muscle power, brutal hitter, wicket-taking death bowler.' },
      { playerName: 'Rishabh Pant', age: 28, role: 'Wicket-Keeper', battingStyle: 'Left-hand bat', bowlingStyle: 'None', basePrice: 1500, category: 'C', description: 'Dynamic keeper-batsman, explosive match winner.' },
      { playerName: 'Sanju Samson', age: 31, role: 'Wicket-Keeper', battingStyle: 'Right-hand bat', bowlingStyle: 'None', basePrice: 1000, category: 'C', description: 'Extremely talented shot maker, calm leader.' },
      { playerName: 'Ishan Kishan', age: 27, role: 'Wicket-Keeper', battingStyle: 'Left-hand bat', bowlingStyle: 'None', basePrice: 1000, category: 'C', description: 'Fearless left-handed keeper batsman.' },
      { playerName: 'Abhishek Sharma', age: 25, role: 'All-Rounder', battingStyle: 'Left-hand bat', bowlingStyle: 'Slow left-arm orthodox', basePrice: 500, category: 'C', description: 'Young explosive opener and orthodox spinner.' },
      { playerName: 'Mayank Yadav', age: 23, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast', basePrice: 300, category: 'C', description: 'Raw speed merchant, bowls consistently over 150 km/h.' },
      { playerName: 'Harshit Rana', age: 24, role: 'Bowler', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm fast-medium', basePrice: 400, category: 'C', description: 'Aggressive wicket-taking seam bowler.' },
 
      // Category D
      { playerName: 'Ayush Badoni', age: 26, role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm offbreak', basePrice: 200, category: 'D', description: 'Talented middle-order utility batsman.' },
      { playerName: 'Ramandeep Singh', age: 29, role: 'All-Rounder', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium', basePrice: 200, category: 'D', description: 'Athletic fielder, hard-hitting finisher.' },
    ];

    const result = await Player.insertMany(mockPlayers);

    await AuditLog.create({
      action: 'SEED_PLAYERS',
      details: 'Wiped existing player catalog and seeded 30 premium international cricketers',
      performedBy: 'ADMIN'
    });

    return res.status(201).json({ message: `Successfully seeded ${result.length} players`, count: result.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error seeding mock players' });
  }
});

export default router;
