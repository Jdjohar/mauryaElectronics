// Layout.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Wrench,
  FileText,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
} from "lucide-react";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // get logged in user from localStorage (fallback to empty object)
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = (user && user.role) ? String(user.role).toLowerCase() : 'guest';

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  }

  // full menu for admin / non-employee users
  const fullMenu = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/" },
    { id: "employees", label: "Manage Employee", icon: Users, to: "/employees" },
    { id: "technicians", label: "Manage Technician", icon: Wrench, to: "/technicians" },
    { id: "complaints", label: "Complaints", icon: FileText, to: "/complaints" },
    { id: "services", label: "Services", icon: Settings, to: "/services" },
    { id: "reports", label: "Reports", icon: BarChart3, to: "/reports" },
  ];

  // employee menu: give employees the full Complaints page (same as Complaints.jsx)
  // plus a quick "Add Complaint" link if desired.
  const employeeMenu = [
    // this will open the full Complaints.jsx page
    { id: "complaints", label: "Complaints", icon: FileText, to: "/complaints" },
    // optional: quick link that points to the add-new complaint route (if you keep a separate /complaints/new)
    { id: "add_complaint", label: "Add Complaint", icon: FileText, to: "/complaints/new" },
  ];

  // choose menu based on role
  const menuItems = role === 'employee' ? employeeMenu : fullMenu;

  const asideWidthClass = sidebarOpen ? "w-64" : "w-20";
  const footerClass = `flex items-center gap-3 ${!sidebarOpen ? "justify-center" : ""}`;
  const linkBase = "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`${asideWidthClass} bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        <header className="p-6 flex items-center justify-between border-b border-slate-700">
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">Maurya Electronics</h1>
              <p className="text-xs text-slate-400 mt-1">Service Management</p>
            </div>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `${linkBase} ${
                        isActive
                          ? "bg-blue-600 text-white shadow-lg"
                          : "text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`
                    }
                  >
                    <Icon size={20} />
                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* FOOTER - USER INFO + LOGOUT */}
        <footer className="p-4 border-t border-slate-700">
          <div className={footerClass}>
            <div
              className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold uppercase"
              title={user?.name || ""}
            >
              {user?.name?.charAt(0) || "U"}
            </div>

            {sidebarOpen && (
              <div className="flex flex-col">
                <p className="text-sm font-medium">{user?.name || "Unknown User"}</p>
                <p className="text-xs text-slate-400">{user?.email || "No email"}</p>
                <p className="text-xs text-slate-400 mt-1 capitalize">{role}</p>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 text-xs text-red-300 hover:text-red-500 transition-colors"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </footer>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
