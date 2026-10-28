import React, { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ProfileModal } from '../profile/ProfileModal';
import { BrandMark } from './BrandMark';
import { getPersonTint } from '../../utils/courseTheme';

interface Props {
  onNavigateHome: () => void;
  isNavOpen: boolean;
  onToggleNav: () => void;
}

export const TopBar: React.FC<Props> = ({ onNavigateHome, isNavOpen, onToggleNav }) => {
  const { session, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!session) return null;

  return (
    <>
      <header className="app-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
          <button
            type="button"
            className="btn btn-ghost btn-icon menu-toggle"
            onClick={onToggleNav}
            aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isNavOpen}
            aria-controls="app-nav"
          >
            {isNavOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>

          {/* Brand */}
          <button type="button" className="app-brand" onClick={onNavigateHome}>
            <BrandMark />
            <span translate="no">ClassOverflow</span>
          </button>
          <span className="app-scope">Semester 3-1 · Computer Science & Engineering</span>
        </div>

        {/* Right: the account (opens the profile) and sign out */}
        <div className="app-account">
          <button
            type="button"
            className="account-button"
            onClick={() => setIsProfileOpen(true)}
            aria-label={`${session.name}, ${session.getRoleLabel()}. Open profile`}
          >
            <span className="avatar" style={{ backgroundColor: getPersonTint(session.name) }} aria-hidden="true">
              {session.avatar}
            </span>
            <span className="account-text">
              <span className="account-name">{session.name}</span>
              <span className="account-role">{session.getRoleLabel()}</span>
            </span>
          </button>

          <button type="button" onClick={logout} className="btn btn-ghost btn-sm" aria-label="Sign out">
            <LogOut size={15} aria-hidden="true" />
            <span className="signout-label">Sign out</span>
          </button>
        </div>
      </header>

      {/* User Profile Modal Interface */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};
