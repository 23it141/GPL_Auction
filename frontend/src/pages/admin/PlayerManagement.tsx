import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, X, Upload, Save, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { Player } from '../../types';
import { useSocket } from '../../context/SocketContext';

const formatPrice = (amount: number): string => {
  return `${amount.toLocaleString()} pts`;
};

interface PlayerManagementProps {
  autoOpenAdd?: boolean;
  onAddOpened?: () => void;
}

const PlayerManagement: React.FC<PlayerManagementProps> = ({ autoOpenAdd, onAddOpened }) => {
  const { addToast, reopenPlayer } = useSocket();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Form States
  const [playerName, setPlayerName] = useState('');
  const [age, setAge] = useState('24');
  const [role, setRole] = useState<'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'>('Batsman');
  const [battingStyle, setBattingStyle] = useState('Right-hand bat');
  const [bowlingStyle, setBowlingStyle] = useState('Right-arm fast');
  const [basePrice, setBasePrice] = useState('2000000'); // 20 Lakhs default
  const [category, setCategory] = useState('A');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');

  // Custom Bulk Paste State
  const [bulkJson, setBulkJson] = useState('');

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (roleFilter) queryParams.append('role', roleFilter);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (categoryFilter) queryParams.append('category', categoryFilter);

      const res = await fetch(`/api/players?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [search, roleFilter, statusFilter, categoryFilter]);

  useEffect(() => {
    if (autoOpenAdd) {
      handleOpenAddModal();
      if (onAddOpened) {
        onAddOpened();
      }
    }
  }, [autoOpenAdd, onAddOpened]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedPlayer(null);
    setPlayerName('');
    setAge('24');
    setRole('Batsman');
    setBattingStyle('Right-hand bat');
    setBowlingStyle('Right-arm fast-medium');
    setBasePrice('2000000');
    setCategory('A');
    setDescription('');
    setPhoto('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (player: Player) => {
    setSelectedPlayer(player);
    setPlayerName(player.playerName);
    setAge(player.age.toString());
    setRole(player.role);
    setBattingStyle(player.battingStyle);
    setBowlingStyle(player.bowlingStyle);
    setBasePrice(player.basePrice.toString());
    setCategory(player.category);
    setDescription(player.description);
    setPhoto(player.photo);
    setIsModalOpen(true);
  };

  const handleDeletePlayer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this player?')) return;

    try {
      const res = await fetch(`/api/players/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      if (res.ok) {
        addToast('success', 'Player deleted successfully');
        fetchPlayers();
      } else {
        const err = await res.json();
        addToast('error', err.message || 'Failed to delete player');
      }
    } catch (e) {
      addToast('error', 'Server error');
    }
  };

  const handleSeedMockData = async () => {
    if (!window.confirm('Wipe current player catalog and populate 30+ premium international cricketers?')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/players/import/mock', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', `Seeded ${data.count} marquee and capped players successfully!`);
        fetchPlayers();
      } else {
        addToast('error', data.message || 'Failed to seed players');
      }
    } catch (e) {
      addToast('error', 'Server connection timed out');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(bulkJson);
      if (!Array.isArray(parsed)) {
        addToast('error', 'JSON must be an array of player objects');
        return;
      }

      const res = await fetch('/api/players/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gpl_auth_token')}`,
        },
        body: JSON.stringify({ players: parsed }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast('success', `Imported ${data.count} players successfully!`);
        setIsImportModalOpen(false);
        setBulkJson('');
        fetchPlayers();
      } else {
        addToast('error', data.message || 'Failed to import players');
      }
    } catch (err: any) {
      addToast('error', `Invalid JSON structure: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      playerName,
      age: Number(age),
      role,
      battingStyle,
      bowlingStyle,
      basePrice: Number(basePrice),
      category,
      description,
      photo,
    };

    try {
      const url = selectedPlayer ? `/api/players/${selectedPlayer._id}` : '/api/players';
      const method = selectedPlayer ? 'PUT' : 'POST';

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
        addToast('success', selectedPlayer ? 'Player updated successfully' : 'Player added successfully');
        setIsModalOpen(false);
        fetchPlayers();
      } else {
        addToast('error', data.message || 'Failed to save player');
      }
    } catch (err) {
      addToast('error', 'Server error saving player details');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans">
            Player Catalog
          </h1>
          <p className="text-slate-500 text-xs font-semibold">
            Add players, filter attributes, or bulk seed files for auction pools.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleSeedMockData}
            className="flex items-center gap-2 px-4 py-2.5 border border-brand-blue/30 bg-blue-50/50 hover:bg-blue-50 text-brand-blue font-bold rounded-xl text-sm transition-all cursor-pointer"
            title="Seed 30 Premium IPL Players"
          >
            <Database className="w-4 h-4" />
            Seed Sample Pool
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
          >
            Bulk JSON Import
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold rounded-xl text-sm shadow-premium transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-premium flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
            placeholder="Search players by name..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All-Rounder">All-Rounder</option>
              <option value="Wicket-Keeper">Wicket-Keeper</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="A">Category A</option>
              <option value="B">Category B</option>
              <option value="C">Category C</option>
              <option value="D">Category D</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="waiting">Waiting</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="unsold">Unsold</option>
            </select>
          </div>
          
          {(search || roleFilter || categoryFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setRoleFilter('');
                setCategoryFilter('');
                setStatusFilter('');
              }}
              className="p-2 text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Players Catalog Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-premium overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 font-semibold gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-brand-blue" />
            <span className="text-xs">Refreshing player list...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Player Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role & Styles</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Base Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                      No matching players found. Click "Seed Sample Pool" to load.
                    </td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <tr key={player._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                            {player.photo ? (
                              <img src={player.photo} alt={player.playerName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-black text-slate-400 uppercase">
                                {player.playerName.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-800">{player.playerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                        {player.age}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-800">{player.role}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{player.battingStyle}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          player.category === 'A' || player.category === 'Marquee'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : player.category === 'B' || player.category === 'Capped'
                            ? 'bg-blue-50 text-brand-blue-dark border-blue-100'
                            : player.category === 'C' || player.category === 'Uncapped'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {player.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                        {formatPrice(player.basePrice)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          player.soldStatus === 'sold'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : player.soldStatus === 'active'
                            ? 'bg-orange-50 text-orange-600 border-orange-200 live-pulse'
                            : player.soldStatus === 'unsold'
                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {player.soldStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {player.soldStatus === 'sold' && player.soldTo && player.soldPrice ? (
                          <div>
                            <p className="text-xs font-bold text-slate-700">{player.soldTo.teamName}</p>
                            <p className="text-[10px] text-brand-green font-bold">{formatPrice(player.soldPrice)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(player.soldStatus === 'sold' || player.soldStatus === 'unsold') && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to reopen bidding for ${player.playerName}?`)) {
                                  reopenPlayer(player._id);
                                }
                              }}
                              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Reopen Bidding (Reset status)"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(player)}
                            className="p-2 text-slate-500 hover:text-brand-blue hover:bg-brand-blue-light rounded-lg transition-colors cursor-pointer"
                            title="Edit Player"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player._id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Player"
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
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedPlayer ? 'Edit Player Specifications' : 'Add Player details'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative bg-slate-50 overflow-hidden shrink-0 group cursor-pointer">
                  {photo ? (
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-brand-blue transition-colors" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Player Photo</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Upload player photo (JPEG/PNG). Optional Base64 caching will apply.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Player Name</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue"
                    placeholder="e.g. Lokesh Rahul"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-blue"
                    placeholder="26"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-brand-blue focus:ring-1"
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Wicket-Keeper">Wicket-Keeper</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-brand-blue"
                  >
                    <option value="A">Category A</option>
                    <option value="B">Category B</option>
                    <option value="C">Category C</option>
                    <option value="D">Category D</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batting Style</label>
                  <input
                    type="text"
                    value={battingStyle}
                    onChange={(e) => setBattingStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none"
                    placeholder="e.g. Right-hand bat"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bowling Style</label>
                  <input
                    type="text"
                    value={bowlingStyle}
                    onChange={(e) => setBowlingStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none"
                    placeholder="e.g. Right-arm offbreak"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Base Price (pts)</label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  placeholder="200"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none h-20"
                  placeholder="Describe player's attributes..."
                />
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
                  Save Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk JSON Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-brand-blue" />
                Bulk Import Players JSON
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2">
                <AlertCircle className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                  Paste a JSON array of player structures. Properties supported: <code className="font-mono bg-blue-100 text-brand-blue px-1 rounded">playerName</code>, <code className="font-mono bg-blue-100 text-brand-blue px-1 rounded">age</code>, <code className="font-mono bg-blue-100 text-brand-blue px-1 rounded">role</code>, <code className="font-mono bg-blue-100 text-brand-blue px-1 rounded">basePrice</code>, <code className="font-mono bg-blue-100 text-brand-blue px-1 rounded">category</code>.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">JSON Data</label>
                <textarea
                  value={bulkJson}
                  onChange={(e) => setBulkJson(e.target.value)}
                  className="w-full h-48 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-blue"
                  placeholder={`[\n  {\n    "playerName": "Lokesh Rahul",\n    "age": 32,\n    "role": "Wicket-Keeper",\n    "basePrice": 15000000,\n    "category": "B"\n  }\n]`}
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl text-sm font-bold shadow-premium cursor-pointer"
                >
                  Import Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerManagement;
