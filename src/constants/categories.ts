// Incident categories — security-specific types for reporting
export const INCIDENT_CATEGORIES = [
  { label: 'Trespass', value: 'Trespass', icon: 'door-open', color: '#e74c3c' },
  { label: 'Graffiti', value: 'Graffiti', icon: 'spray', color: '#9b59b6' },
  { label: 'Theft', value: 'Theft', icon: 'lock-off', color: '#e67e22' },
  { label: 'Assault', value: 'Assault', icon: 'account-alert', color: '#c0392b' },
  { label: 'Suspicious Person', value: 'Suspicious Person', icon: 'eye-outline', color: '#8e44ad' },
  { label: 'Medical', value: 'Medical', icon: 'medical-bag', color: '#27ae60' },
  { label: 'Fire', value: 'Fire', icon: 'fire', color: '#d35400' },
  { label: 'Active Threat', value: 'Active Threat', icon: 'alert-octagon', color: '#B22222' },
  { label: 'Vandalism', value: 'Vandalism', icon: 'hammer', color: '#34495e' },
  { label: 'Other', value: 'Other', icon: 'dots-horizontal-circle', color: '#7f8c8d' },
] as const;

export const INCIDENT_CATEGORY_LABELS = ['All', ...INCIDENT_CATEGORIES.map(c => c.label)];

export const INCIDENT_CATEGORY_COLORS: { [key: string]: string } = Object.fromEntries(
  INCIDENT_CATEGORIES.map(c => [c.value, c.color])
);

// Alert severity levels
export const ALERT_LEVELS = [
  { value: 'yellow' as const, label: 'YELLOW ALERT', subtitle: 'Situational Awareness', icon: 'eye-outline' },
  { value: 'red' as const, label: 'RED ALERT', subtitle: 'Imminent Threat', icon: 'alert-octagon' },
] as const;

export const ALERT_LEVEL_COLORS: { [key: string]: string } = {
  yellow: '#F59E0B',
  red: '#B22222',
};

// Watchlist statuses
export const WATCHLIST_STATUSES = [
  { label: 'Active', value: 'active' as const, color: '#e74c3c' },
  { label: 'Monitoring', value: 'monitoring' as const, color: '#e67e22' },
  { label: 'Resolved', value: 'resolved' as const, color: '#27ae60' },
];

export const WATCHLIST_STATUS_COLORS: { [key: string]: string } = Object.fromEntries(
  WATCHLIST_STATUSES.map(s => [s.value, s.color])
);

// Resource categories — shared single source of truth
export const RESOURCE_CATEGORIES = [
  'First Aid',
  'Law Enforcement',
  'Fire Safety',
  'Active Shooter',
  'Cybersecurity',
  'Training',
  'Best Practices',
  'Past Incidents',
  'Equipment',
  'Other',
] as const;

export const RESOURCE_CATEGORIES_WITH_ALL = ['All', ...RESOURCE_CATEGORIES];

export const RESOURCE_CATEGORY_COLORS: { [key: string]: string } = {
  'First Aid': '#e74c3c',
  'Law Enforcement': '#3498db',
  'Fire Safety': '#e67e22',
  'Active Shooter': '#c0392b',
  'Cybersecurity': '#9b59b6',
  'Training': '#27ae60',
  'Best Practices': '#16a085',
  'Past Incidents': '#95a5a6',
  'Equipment': '#34495e',
  'Other': '#7f8c8d',
};
