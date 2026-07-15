// Canonical module list mirrored from backend users.controller.js.
// Used in the UserAdmin form to render per-module access checkboxes.
export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Core' },
  { key: 'showrooms', label: 'Showrooms (floor view)', group: 'Core' },
  { key: 'pieces', label: 'Pieces (cross-search)', group: 'Inventory' },
  { key: 'add_piece', label: 'Add piece', group: 'Inventory' },
  { key: 'transfer', label: 'Transfer piece', group: 'Inventory' },
  { key: 'scan', label: 'QR scan', group: 'Inventory' },
  { key: 'reserve', label: 'Reservations', group: 'Sales' },
  { key: 'sale', label: 'Record sale', group: 'Sales' },
  { key: 'reports', label: 'Reports', group: 'Reports' },
  { key: 'admin_locations', label: 'Manage locations', group: 'Admin' },
  { key: 'admin_users', label: 'Manage users', group: 'Admin' },
];

export const DEPARTMENTS = [
  'Admin',
  'Showroom',
  'Sales',
  'Inventory',
  'Accounts',
  'Operations',
];

export const ROLES = [
  { value: 'ADMIN', label: 'Admin (full access)' },
  { value: 'MANAGER', label: 'Manager (a parent showroom)' },
  { value: 'SHOWROOM_STAFF', label: 'Showroom Staff (a sub-showroom)' },
  { value: 'EMPLOYEE', label: 'Employee (unscoped)' },
];

export const modulesGrouped = () => {
  const groups = {};
  for (const m of MODULES) {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  }
  return groups;
};
