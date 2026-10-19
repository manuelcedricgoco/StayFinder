import {
  BadgeCheck,
  Building2,
  CreditCard,
  Database,
  Flag,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Search,
  ShieldCheck,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../types/auth';

export interface PanelNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** true = highlight only on this exact URL (used for each panel's Dashboard) */
  end?: boolean;
}

export interface PanelConfig {
  title: string;
  items: PanelNavItem[];
  // Full class strings (Tailwind only generates classes it can find written out in the source).
  // Every panel shares the same neutral dark shell; only the accent fields below differ per role.
  sidebar: string;
  divider: string;
  brandText: string;
  muted: string;
  activeLink: string;
  activeBorder: string;
  activeIcon: string;
  idleLink: string;
  badge: string;
}

// One shell for all three panels: identical in light and dark mode, so the sidebar never
// fights the theme. The active item is marked by the border, the icon and the badge only.
const SHELL = {
  sidebar: 'border-r border-slate-800 bg-slate-900 text-slate-300 dark:border-slate-700 dark:bg-slate-950',
  divider: 'border-slate-800 dark:border-slate-700',
  brandText: 'text-white',
  muted: 'text-slate-400',
  activeLink: 'bg-white/10 text-white',
  idleLink: 'text-slate-300 hover:bg-white/5 hover:text-white',
};

// One panel per role. To add a page to a panel, add an item here and a route in router.tsx.
export const PANEL_CONFIG: Record<Role, PanelConfig> = {
  ADMIN: {
    ...SHELL,
    title: 'Admin Panel',
    activeBorder: 'border-l-amber-400',
    activeIcon: 'text-amber-300',
    badge: 'bg-amber-400/15 text-amber-300',
    items: [
      { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
      { label: 'Listings', to: '/admin/properties', icon: Building2 },
      { label: 'Users', to: '/admin/users', icon: Users },
      { label: 'Reviews', to: '/admin/reviews', icon: Star },
      { label: 'Reports', to: '/admin/reports', icon: Flag },
      { label: 'Verifications', to: '/admin/verifications', icon: BadgeCheck },
      { label: 'Security', to: '/admin/security', icon: ShieldCheck },
      { label: 'Export Database', to: '/admin/export', icon: Database },
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
  OWNER: {
    ...SHELL,
    title: 'Owner Panel',
    activeBorder: 'border-l-emerald-400',
    activeIcon: 'text-emerald-300',
    badge: 'bg-emerald-400/15 text-emerald-300',
    items: [
      { label: 'Dashboard', to: '/owner', icon: LayoutDashboard, end: true },
      { label: 'My Properties', to: '/owner/properties', icon: Building2 },
      { label: 'Inquiries', to: '/owner/inquiries', icon: MessageSquare },
      { label: 'Reviews', to: '/owner/reviews', icon: Star },
      { label: 'Verification', to: '/owner/verification', icon: BadgeCheck },
      { label: 'Payments', to: '/owner/payments', icon: CreditCard },
      { label: 'Settings', to: '/owner/settings', icon: Settings },
    ],
  },
  BOARDER: {
    ...SHELL,
    title: 'Boarder Panel',
    activeBorder: 'border-l-rose-400',
    activeIcon: 'text-rose-300',
    badge: 'bg-rose-400/15 text-rose-300',
    items: [
      { label: 'Dashboard', to: '/boarder', icon: LayoutDashboard, end: true },
      { label: 'Find a Place', to: '/boarder/find-place', icon: Search },
      { label: 'Favorites', to: '/boarder/favorites', icon: Heart },
      { label: 'Inquiries', to: '/boarder/inquiries', icon: MessageSquare },
      { label: 'My Reviews', to: '/boarder/reviews', icon: Star },
      { label: 'My Reports', to: '/boarder/reports', icon: Flag },
      { label: 'Settings', to: '/boarder/settings', icon: Settings },
    ],
  },
};
