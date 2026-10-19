import { Link } from 'react-router-dom';
import { Flag, Heart, Mail, Star, Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const mockActivity = [
  { id: 1, text: 'Owner replied to your inquiry for "Looc Budget Bedspace"', time: '2 hours ago' },
  { id: 2, text: 'Your review for "San Jose Transient House" was approved', time: '1 day ago' },
];

const mockRecommendations = [
  { id: 1, name: 'Modern Studio in San Jose', price: '₱3,500', location: 'San Jose' },
  { id: 2, name: 'Budget-friendly Room', price: '₱2,000', location: 'Looc' },
  { id: 3, name: 'Coastal Bedspace', price: '₱2,800', location: 'Sablayan' },
];

export function BoarderDashboardPage() {
  const { user } = useAuth();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Welcome, {user?.name}</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        </div>
        <Link 
          to="/properties" 
          className="inline-flex w-fit items-center rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-800"
        >
          Find a place
        </Link>
      </div>

      {/* Main Dashboard Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Main Content Area (Left) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { to: '/boarder/favorites', icon: Heart, title: 'Saved properties', status: '5 properties' },
              { to: '/boarder/inquiries', icon: Mail, title: 'My inquiries', status: '2 unread' },
              { to: '/boarder/reviews', icon: Star, title: 'My reviews', status: '2 published' },
              { to: '/boarder/reports', icon: Flag, title: 'My reports', status: '1 active' },
            ].map((item) => (
              <Link 
                key={item.to} 
                to={item.to} 
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm transition hover:border-emerald-300"
              >
                <item.icon className="text-emerald-700 dark:text-emerald-400" size={24} />
                <h2 className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{item.title}</h2>
                <p className="mt-1 inline-block rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">{item.status}</p>
              </Link>
            ))}
          </div>

          {/* Recommended Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recommended for you</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {mockRecommendations.map((rec) => (
                <div key={rec.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4 transition hover:border-slate-200 dark:hover:border-slate-700">
                  <div className="mb-3 h-24 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
                  <p className="truncate font-medium text-sm text-slate-900 dark:text-slate-100">{rec.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{rec.location} • {rec.price}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Activity Feed (Right) */}
        <div className="lg:col-span-4">
          <div className="h-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="text-emerald-700 dark:text-emerald-400" size={20} />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h3>
            </div>
            <div className="space-y-4">
              {mockActivity.map((act) => (
                <div key={act.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{act.text}</p>
                  <p className="mt-1 text-xs text-slate-400">{act.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
