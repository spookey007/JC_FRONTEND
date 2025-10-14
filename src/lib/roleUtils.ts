/**
 * Role management utilities
 */

export const USER_ROLES = {
  ADMIN: 0,
  MEMBER: 1,
  MODERATOR: 2,
  DEV: 3
} as const;

export const ROLE_NAMES = {
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.MEMBER]: 'Member',
  [USER_ROLES.MODERATOR]: 'Moderator',
  [USER_ROLES.DEV]: 'Developer'
} as const;

export const ROLE_COLORS = {
  [USER_ROLES.ADMIN]: '#ff6b6b', // Red
  [USER_ROLES.MEMBER]: '#96ceb4', // Green
  [USER_ROLES.MODERATOR]: '#45b7d1', // Blue
  [USER_ROLES.DEV]: '#4ecdc4'   // Teal
} as const;

export const ROLE_ICONS = {
  [USER_ROLES.ADMIN]: '👑',
  [USER_ROLES.MEMBER]: '👤',
  [USER_ROLES.MODERATOR]: '🛡️',
  [USER_ROLES.DEV]: '💻'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Get role name from role number
 */
export function getRoleName(role: number): string {
  return ROLE_NAMES[role as UserRole] || 'Unknown';
}

/**
 * Get role color from role number
 */
export function getRoleColor(role: number): string {
  return ROLE_COLORS[role as UserRole] || '#96ceb4';
}

/**
 * Get role icon from role number
 */
export function getRoleIcon(role: number): string {
  return ROLE_ICONS[role as UserRole] || '👤';
}

/**
 * Check if user has admin privileges
 */
export function isAdmin(role: number): boolean {
  return role === USER_ROLES.ADMIN;
}

/**
 * Check if user has member privileges
 */
export function isMember(role: number): boolean {
  return role === USER_ROLES.MEMBER;
}

/**
 * Check if user has moderator privileges
 */
export function isModerator(role: number): boolean {
  return role === USER_ROLES.MODERATOR;
}

/**
 * Check if user has dev privileges
 */
export function isDev(role: number): boolean {
  return role === USER_ROLES.DEV;
}

/**
 * Check if user has admin or dev privileges
 */
export function isAdminOrDev(role: number): boolean {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.DEV;
}

/**
 * Check if user has admin, dev, or moderator privileges
 */
export function hasModeratorPrivileges(role: number): boolean {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.DEV || role === USER_ROLES.MODERATOR;
}

/**
 * Get role priority (lower number = higher priority)
 */
export function getRolePriority(role: number): number {
  return role;
}

/**
 * Compare two roles by priority
 */
export function compareRoles(role1: number, role2: number): number {
  return getRolePriority(role1) - getRolePriority(role2);
}

/**
 * Sort users by role priority (admin first, then dev, moderator, member)
 */
export function sortUsersByRole<T extends { role: number }>(users: T[]): T[] {
  return [...users].sort((a, b) => compareRoles(a.role, b.role));
}
