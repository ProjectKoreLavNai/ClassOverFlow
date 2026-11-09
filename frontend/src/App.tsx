import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { ForbiddenModal } from './components/security/ForbiddenModal';
import { ClassroomsHome } from './components/views/ClassroomsHome';
import { CRDeskView } from './components/views/CRDeskView';
import { StudentTodoView } from './components/views/StudentTodoView';
import { AdminAccountsView } from './components/views/AdminAccountsView';
import { AdminCoursesView } from './components/views/AdminCoursesView';
import { AIStudioView } from './components/views/AIStudioView';

const MainApplication: React.FC = () => {
  const { session, securityViolation, clearViolation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('classrooms');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [openCourseCode, setOpenCourseCode] = useState<string | null>(null);
  const selectCourseCode = useCallback((code: string | null) => setOpenCourseCode(code), []);

  // Whenever a session logs in or switches, jump to their authorized landing route
  useEffect(() => {
    if (session) {
      setActiveTab(session.getLandingRoute());
      setOpenCourseCode(null);
    }
  }, [session?.id, session?.role]);

  // If user is unauthenticated, show the Split-Card Auth Page
  if (!session) {
    return <AuthPage />;
  }

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setOpenCourseCode(null);
    setIsNavOpen(false);
  };

  const openCourse = (code: string) => {
    setActiveTab('classrooms');
    setOpenCourseCode(code);
    setIsNavOpen(false);
  };

  return (
    <div className="app">
      {/* Top bar: product mark and scope, the account, sign out; the menu button on a phone */}
      <TopBar
        onNavigateHome={() => selectTab(session.getLandingRoute())}
        isNavOpen={isNavOpen}
        onToggleNav={() => setIsNavOpen((open) => !open)}
      />

      <div className="app-body">
        {/* Left sidebar with RBAC Proxy navigation checks; a full-screen sheet on a phone */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={selectTab}
          isOpen={isNavOpen}
          activeCourseCode={activeTab === 'classrooms' ? openCourseCode : null}
          onSelectCourse={openCourse}
        />

        {/* Dynamic Workspace View */}
        <main className="app-main" id="main">
          {activeTab === 'classrooms' && <ClassroomsHome selectedCode={openCourseCode} onSelectCode={selectCourseCode} />}
          {activeTab === 'todo' && <StudentTodoView />}
          {activeTab === 'crdesk' && <CRDeskView />}
          {activeTab === 'admin-accounts' && <AdminAccountsView />}
          {activeTab === 'admin-courses' && <AdminCoursesView />}
          {activeTab === 'aistudio' && <AIStudioView />}
        </main>
      </div>

      {/* 403 Forbidden Security Bouncer Modal (Proxy Pattern) */}
      <ForbiddenModal
        violation={securityViolation}
        onClose={clearViolation}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
};

export default App;
