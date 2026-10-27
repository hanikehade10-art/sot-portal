/**
 * Single source of truth configuration for the School of Technology Student Portal.
 * You can edit the contact details, student representatives, portal metadata, and departments here.
 */

export const SOT_DEPARTMENTS_CONFIG = [
  'Computer Technology',
  'Food Science and Technology',
  'Hospitality Management',
  'Tourism Management',
  'Polymer and Textile Management',
  'Nutrition and Dietetics'
] as const;

export type SotDepartmentConfigName = typeof SOT_DEPARTMENTS_CONFIG[number];

export const DEPARTMENT_COUNT = 6;

export const SITE_CONFIG = {
  portalName: 'School of Technology (SOT) Student Portal',
  shortName: 'SOT Student Portal',
  tagline: 'Built by students, for students',
  description: 'School of Technology offering computer technology, food science, hospitality, tourism, nutrition and polymer & textile management programmes.',
  departmentCount: DEPARTMENT_COUNT,
  departments: SOT_DEPARTMENTS_CONFIG,
  
  // Student Representative Contact Details
  contact: {
    representativeName: 'Martins Gloria Oluwaferanmi',
    phone: '08072176797',
    email: 'hanikehade10@gmail.com',
    location: 'Student Union Secretariat, Technology Wing',
    officeHours: 'Mon - Fri: 10:00 AM - 04:00 PM (Student Hours)'
  },

  // Security & Inactivity lock parameters
  security: {
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    inactivityTimeoutMinutes: 30
  },

  // Bootstrapped admin email
  bootstrapAdminEmail: 'kemibuhari8@gmail.com'
};
