import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import os from 'os';
import Team from '../models/Team';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import AuditLog from '../models/AuditLog';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gpl_auction_super_secret_key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Admin Login
router.post('/admin/login', async (req, res): Promise<any> => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ id: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    
    await AuditLog.create({
      action: 'ADMIN_LOGIN',
      details: 'Administrator logged in successfully',
      performedBy: 'ADMIN'
    });

    return res.json({
      token,
      user: { id: 'admin', role: 'admin', username: 'Administrator' },
    });
  }

  return res.status(401).json({ message: 'Invalid admin credentials' });
});

// Captain Login
router.post('/captain/login', async (req, res): Promise<any> => {
  const { teamCode, pin } = req.body;

  if (!teamCode || !pin) {
    return res.status(400).json({ message: 'Team Code and PIN are required' });
  }

  try {
    const team = await Team.findOne({ teamCode: teamCode.toUpperCase(), pin });
    if (!team) {
      return res.status(401).json({ message: 'Invalid Team Code or PIN' });
    }

    const token = jwt.sign(
      { id: team._id.toString(), role: 'captain', teamCode: team.teamCode },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    await AuditLog.create({
      action: 'CAPTAIN_LOGIN',
      details: `Captain for ${team.teamName} (${team.teamCode}) logged in`,
      performedBy: team.teamCode
    });

    return res.json({
      token,
      user: {
        id: team._id,
        role: 'captain',
        teamCode: team.teamCode,
        teamName: team.teamName,
        captainName: team.captainName,
        logo: team.logo,
        purse: team.remainingPurse
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error during captain login' });
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    if (req.user.role === 'admin') {
      return res.json({ id: 'admin', role: 'admin', username: 'Administrator' });
    } else {
      const team = await Team.findById(req.user.id);
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }
      return res.json({
        id: team._id,
        role: 'captain',
        teamCode: team.teamCode,
        teamName: team.teamName,
        captainName: team.captainName,
        logo: team.logo,
        purse: team.remainingPurse
      });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error getting current user' });
  }
});

// Public viewer token — no credentials needed, read-only role
router.get('/public-token', (req, res) => {
  const token = jwt.sign(
    { id: 'public', role: 'viewer' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token });
});

// Get Host IP for LAN network QR Code connections
router.get('/host-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses: { ip: string; name: string }[] = [];

  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if ((alias.family === 'IPv4' || (alias.family as any) === 4) && !alias.internal) {
          addresses.push({ ip: alias.address, name: devName.toLowerCase() });
        }
      }
    }
  }

  if (addresses.length === 0) {
    res.json({ ip: 'localhost' });
    return;
  }

  // Helper to detect virtual network adapters
  const isVirtual = (name: string) => {
    return name.includes('virtual') ||
           name.includes('vbox') ||
           name.includes('wsl') ||
           name.includes('vmnet') ||
           name.includes('vethernet') ||
           name.includes('docker');
  };

  // 1. Try physical Wi-Fi / WLAN first
  const wifiIp = addresses.find(addr => 
    (addr.name.includes('wi-fi') || addr.name.includes('wlan') || addr.name.includes('wireless')) && 
    !isVirtual(addr.name)
  );
  if (wifiIp) {
    res.json({ ip: wifiIp.ip });
    return;
  }

  // 2. Try physical Ethernet next
  const ethIp = addresses.find(addr => 
    (addr.name.includes('ethernet') || addr.name.includes('eth') || addr.name.includes('lan')) && 
    !isVirtual(addr.name)
  );
  if (ethIp) {
    res.json({ ip: ethIp.ip });
    return;
  }

  // 3. Try any physical adapter
  const physicalIp = addresses.find(addr => !isVirtual(addr.name));
  if (physicalIp) {
    res.json({ ip: physicalIp.ip });
    return;
  }

  // 4. Fallback to first available IP
  res.json({ ip: addresses[0].ip });
});

export default router;
