'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FolderPlus, 
  Folder, 
  Check, 
  Trash2, 
  Edit3, 
  Star, 
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

export default function SpacesPage() {
  const { 
    spaces, 
    activeSpaceId, 
    switchSpace, 
    apiFetch, 
    fetchSpaces, 
    isOffline 
  } = useApp();

  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Submit new space
  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newSpaceName.trim() || isOffline) return;
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    const data = await apiFetch('/api/spaces', {
      method: 'POST',
      body: JSON.stringify({ name: newSpaceName }),
    });

    if (data && !data.error) {
      setNewSpaceName('');
      await fetchSpaces();
      setMessage({ text: `Space "${data.name}" created successfully.`, type: 'success' });
    } else {
      setMessage({ text: data.error || 'Failed to create space', type: 'error' });
    }
    setIsLoading(false);
  };

  // Start editing space rename
  const startEditing = (space) => {
    setEditingSpaceId(space._id);
    setEditingName(space.name);
  };

  // Submit rename
  const handleRenameSpace = async (id) => {
    if (!editingName.trim() || isOffline) return;
    setIsLoading(true);
    const data = await apiFetch(`/api/spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editingName }),
    });

    if (data && !data.error) {
      setEditingSpaceId(null);
      await fetchSpaces();
    } else {
      alert(data.error || 'Failed to rename space');
    }
    setIsLoading(false);
  };

  // Set space as default
  const handleSetDefaultSpace = async (id) => {
    if (isOffline) return;
    setIsLoading(true);
    const data = await apiFetch(`/api/spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isDefault: true }),
    });

    if (data && !data.error) {
      await fetchSpaces();
    }
    setIsLoading(false);
  };

  // Delete space cascade
  const handleDeleteSpace = async (space) => {
    if (isOffline) return;
    if (space.isDefault) {
      alert('You cannot delete your default space. Please set another space as default first.');
      return;
    }

    const confirmMsg = `WARNING: Are you absolutely sure you want to delete the space "${space.name}"?\n\nThis will PERMANENTLY ERASE all raw transactions, categories, monthly summaries, and reconciliation logs recorded under this space.\n\nThis action cannot be undone.`;
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsLoading(true);
    const data = await apiFetch(`/api/spaces/${space._id}`, {
      method: 'DELETE',
    });

    if (data && !data.error) {
      // If we just deleted the active space, switch to the default one
      await fetchSpaces();
      if (activeSpaceId === space._id) {
        // Find the default one
        const updatedList = await apiFetch('/api/spaces');
        const fallback = updatedList.find(s => s.isDefault) || updatedList[0];
        if (fallback) {
          switchSpace(fallback._id);
        }
      }
      setMessage({ text: 'Space successfully deleted along with all its transaction history.', type: 'success' });
    } else {
      setMessage({ text: data.error || 'Failed to delete space', type: 'error' });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 mt-1 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight font-display text-white">
          Manage Spaces
        </h1>
        <span className="text-xs text-slate-400 font-semibold mt-0.5 block">
          Isolate transactions between Personal Life, Trips, Family, and Business.
        </span>
      </div>

      {/* Message feedback */}
      {message.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'}`}>
          {message.text}
        </div>
      )}

      {/* Create Space Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
          <FolderPlus className="w-4 h-4 text-indigo-400" /> Create New Space
        </h3>
        
        <form onSubmit={handleCreateSpace} className="flex gap-2">
          <input
            type="text"
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            placeholder="e.g. Goa Trip 2026, Petty Cash"
            required
            disabled={isOffline || isLoading}
            className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-all"
          />
          <button
            type="submit"
            disabled={isOffline || isLoading || !newSpaceName.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all"
          >
            Create
          </button>
        </form>
      </div>

      {/* Spaces list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1">
          Your Workspaces
        </h3>

        {spaces.map((space) => {
          const isActive = space._id === activeSpaceId;
          const isEditing = space._id === editingSpaceId;

          return (
            <div
              key={space._id}
              onClick={() => !isActive && !isEditing && switchSpace(space._id)}
              className={`bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 transition-all flex items-center justify-between gap-3 ${
                isActive 
                  ? 'bg-slate-900/95 shadow-md' 
                  : 'hover:border-slate-700 cursor-pointer active:scale-[0.99]'
              }`}
            >
              {/* Left Column: Icon and Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-2.5 rounded-xl shrink-0 ${isActive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}>
                  <FolderOpen className="w-4 h-4" />
                </div>

                {isEditing ? (
                  <div className="flex gap-1.5 items-center w-full max-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-1.5 text-xs text-white outline-none w-full font-bold transition-all"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameSpace(space._id);
                      }}
                      className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg shrink-0 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-200 flex items-center gap-1.5 truncate">
                      <span className="truncate">{space.name}</span>
                      {space.isDefault && (
                        <span className="text-[8px] font-extrabold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                      Created {new Date(space.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Set Default */}
                {!space.isDefault && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefaultSpace(space._id);
                    }}
                    disabled={isOffline}
                    className="p-1.5 bg-slate-950/60 border border-slate-800 hover:border-indigo-500/30 hover:text-indigo-400 rounded-lg text-slate-400 transition-all cursor-pointer"
                    title="Set Default"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Edit rename */}
                {!isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(space);
                    }}
                    className="p-1.5 bg-slate-950/60 border border-slate-800 hover:border-indigo-500/30 hover:text-indigo-400 rounded-lg text-slate-400 transition-all cursor-pointer"
                    title="Rename Space"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                
                {/* Delete */}
                {!space.isDefault && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSpace(space);
                    }}
                    disabled={isOffline}
                    className="p-1.5 bg-slate-950/60 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-900/30 rounded-lg text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                    title="Delete Space"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Switch Space indicator */}
                {!isActive && !isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      switchSpace(space._id);
                    }}
                    className="ml-1 text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                  >
                    Switch
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
