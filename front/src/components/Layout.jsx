import { useState } from 'react';
import { LayoutDashboard, Users, Wrench, FileText, Settings, BarChart3, Menu, X } from 'lucide-react';

export default function Layout({ children, currentPage, onNavigate }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Manage Employee', icon: Users },
    { id: 'technicians', label: 'Manage Technician', icon: Wrench },
    { id: 'complaints', label: 'Complaints', icon: FileText },
    { id: 'services', label: 'Services', icon: Settings },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const asideWidthClass = sidebarOpen ? 'w-64' : 'w-20';
  const footerClass = `flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`${asideWidthClass} bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-700">
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">Repair CRM</h1>
              <p className="text-xs text-slate-400 mt-1">Service Management</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon size={20} />
                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className={footerClass}>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
              A
            </div>
            {sidebarOpen && (
              <div>
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-slate-400">admin@repair.com</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
