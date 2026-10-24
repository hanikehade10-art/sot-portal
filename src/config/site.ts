/**
 * Single source of truth configuration for the School of Technology Student Portal.
 * You can edit the contact details, student representatives, and portal metadata here.
 */

export const SITE_CONFIG = {
  portalName: 'School of Technology (SOT) Student Portal',
  shortName: 'SOT Student Portal',
  tagline: 'Built by students, for students',
  disclaimer: 'Student-run portal. Not an official university channel.',
  description: 'School of Technology offering technology, agriculture, food, hospitality, tourism, nutrition and textile programmes.',
  
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
