import {
  BadgeCheck,
  LayoutDashboard,
  Lightbulb,
  Radar,
  Rss,
  Settings,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/opportunities', label: 'Opportunities', icon: Lightbulb },
  { to: '/problems', label: 'Problem Intelligence', icon: TrendingUp },
  { to: '/leads', label: 'Leads / CRM', icon: Users },
  { to: '/service-ideas', label: 'Service Ideas', icon: Wrench },
  { to: '/sources', label: 'Sources', icon: Rss },
  { to: '/skills', label: 'Skills & Profile', icon: BadgeCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Radar className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Opportunity Intelligence</p>
          <p className="truncate text-xs text-muted-foreground">faindaGeeg</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Phase 0</div>
    </aside>
  );
}
