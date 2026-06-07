import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Plus, Edit2, Trash2, QrCode, X, Upload, Save, Sparkles, Key } from 'lucide-react';
import { Team } from '../../types';
import { useSocket } from '../../context/SocketContext';

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

const TeamManagement: React.FC = () => {
  const { addToast } = useSocket();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [hostIp, setHostIp] = useState('');

  // Form States
  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [logo, setLogo] = useState('');
  const [initialPurse, setInitialPurse] = useState('10000'); // 10,000 pts default
  const [teamCode, setTeamCode] = useState('');
  const [pin, setPin] = useState('');

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHostIp = async () => {
    try {
      const res = await fetch('/api/auth/host-ip');
      if (res.ok) {
        const data = await res.json();
        setHostIp(data.ip);
      }
    } catch (err) {
      console.error('Failed to fetch host IP:', err);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchHostIp();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedTeam(null);
    setTeamName('');
    setCaptainName('');
    setMobileNumber('');
    setLogo('');
    setInitialPurse('100000000');
    setTeamCode('');
    setPin(Math.floor(1000 + Math.random() * 9000).toString()); // Pre-fill random PIN
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (team: Team) => {
    setSelectedTeam(team);
    setTeamName(team.teamName);
    setCaptainName(team.captainName);
    setMobileNumber(team.mobileNumber);
    setLogo(team.logo);
    setInitialPurse(team.initialPurse.toString());
    setTeamCode(team.teamCode);
    setPin(team.pin);
    setIsModalOpen(true);
  };

  const handleDeleteTeam = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this team? All their purchased players will be reset back to waiting!')) {
      return;
    }

    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        addToast('success', 'Team deleted successfully');
        fetchTeams();
      } else {
        const err = await res.json();
        addToast('error', err.message || 'Failed to delete team');
      }
    } catch (e) {
      addToast('error', 'Server error deleting team');
    }
  };

  const handleShowQrCode = async (team: Team) => {
    setSelectedTeam(team);
    try {
      // Determine host IP (allows access via mobile QR codes on local network)
      let host = window.location.hostname;
      if ((host === 'localhost' || host === '127.0.0.1') && hostIp) {
        host = hostIp;
      }
      const port = window.location.port ? `:${window.location.port}` : '';
      const loginUrl = `${window.location.protocol}//${host}${port}/captain/login?code=${team.teamCode}`;
      
      const qrDataUrl = await QRCode.toDataURL(loginUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e293b', // Slate 850
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
      setIsQrModalOpen(true);
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to generate QR Code');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      teamName,
      captainName,
      mobileNumber,
      logo,
      initialPurse: Number(initialPurse),
      teamCode,
      pin,
    };

    try {
      const url = selectedTeam ? `/api/teams/${selectedTeam._id}` : '/api/teams';
      const method = selectedTeam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        addToast('success', selectedTeam ? 'Team updated successfully' : 'Team added successfully');
        setIsModalOpen(false);
        fetchTeams();
      } else {
        addToast('error', data.message || 'Failed to save team');
      }
    } catch (err) {
      addToast('error', 'Network error occurred');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans">
            Team Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold">
            Add team captains, manage purse credits, and generate QR login passes.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold rounded-xl text-sm shadow-premium transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Team
        </button>
      </div>

      {/* Teams Grid / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Logo & Team</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Captain Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Initial Purse</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Purse</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Access PIN</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                    No teams registered yet. Click "Add Team" to start.
                  </td>
                </tr>
              ) : (
                teams.map((team) => (
                  <tr key={team._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                          {team.logo ? (
                            <img src={team.logo} alt={team.teamName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-black text-brand-blue">{team.teamCode}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{team.teamName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Squad: {team.squadSize}/18</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {team.teamCode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-700">{team.captainName}</p>
                      <p className="text-xs text-slate-500 font-medium">{team.mobileNumber}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                      {formatPrice(team.initialPurse)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-extrabold text-brand-blue">
                        {formatPrice(team.remainingPurse)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Key className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-mono font-bold tracking-widest">{team.pin}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleShowQrCode(team)}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Generate Login QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(team)}
                          className="p-2 text-slate-500 hover:text-brand-blue hover:bg-brand-blue-light rounded-lg transition-colors cursor-pointer"
                          title="Edit Team"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team._id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedTeam ? 'Edit Team Details' : 'Register New Team'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative bg-slate-50 overflow-hidden shrink-0 group cursor-pointer">
                  {logo ? (
                    <img src={logo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-brand-blue transition-colors" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Logo</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Upload team badge (JPEG/PNG). Automatic preview will update.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                    placeholder="e.g. Mumbai Titans"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Code</label>
                  <input
                    type="text"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase().slice(0, 5))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                    placeholder="e.g. MUM (Max 5 Chars)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Captain Name</label>
                  <input
                    type="text"
                    value={captainName}
                    onChange={(e) => setCaptainName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue"
                    placeholder="Captain Name"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue"
                    placeholder="Mobile Number"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initial Purse (pts)</label>
                  <input
                    type="number"
                    value={initialPurse}
                    onChange={(e) => setInitialPurse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue"
                    placeholder="10000"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access PIN</label>
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-brand-blue"
                    placeholder="4-digit PIN"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl text-sm font-bold shadow-premium cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrModalOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 text-center space-y-4 animate-slide-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-800 text-sm">Dashboard Login QR Code</span>
              <button onClick={() => setIsQrModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl inline-flex justify-center shadow-inner">
              <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 object-contain" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-800 text-lg">{selectedTeam.teamName}</h4>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Team Code: <span className="font-bold text-brand-blue">{selectedTeam.teamCode}</span>
              </p>
              <p className="text-xs font-mono font-bold text-slate-600 tracking-wider">
                Login PIN: <span className="bg-slate-100 px-2 py-0.5 rounded text-brand-blue font-bold">{selectedTeam.pin}</span>
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-left flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Instant Setup Instructions</p>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                  1. Scan this QR code with the captain's phone camera.<br />
                  2. The login page will open pre-filled with the code.<br />
                  3. Enter PIN <span className="font-mono font-bold text-brand-blue">{selectedTeam.pin}</span> to unlock the dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
