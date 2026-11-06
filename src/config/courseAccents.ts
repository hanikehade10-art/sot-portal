/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CourseAccentColor } from '../types';

export interface AccentTheme {
  name: CourseAccentColor;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentText: string;
  accentBorder: string;
  accentBg: string;
  accentBgSubtle: string;
  buttonBg: string;
  buttonHover: string;
  progressGradient: string;
  stroke: string;
  tickBg: string;
  tickText: string;
  underline: string;
  borderHover: string;
  coverGradient: string;
  iconBg: string;
}

export const COURSE_ACCENT_COLORS: Record<CourseAccentColor, AccentTheme> = {
  Teal: {
    name: 'Teal',
    label: 'Teal',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    badgeBorder: 'border-teal-500/40',
    accentText: 'text-teal-400',
    accentBorder: 'border-teal-500/50',
    accentBg: 'bg-teal-500',
    accentBgSubtle: 'bg-teal-950/40',
    buttonBg: 'bg-teal-600 hover:bg-teal-500',
    buttonHover: 'hover:bg-teal-500',
    progressGradient: 'from-teal-500 to-teal-300',
    stroke: '#14b8a6',
    tickBg: 'bg-teal-500/20 text-teal-300 border-teal-500/50',
    tickText: 'text-teal-400',
    underline: 'bg-teal-400',
    borderHover: 'hover:border-teal-500/70',
    coverGradient: 'from-teal-900/90 via-[#0F1E36] to-[#0A1224]',
    iconBg: 'bg-teal-500/20 text-teal-300'
  },
  Emerald: {
    name: 'Emerald',
    label: 'Emerald',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/40',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/50',
    accentBg: 'bg-emerald-500',
    accentBgSubtle: 'bg-emerald-950/40',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-500',
    buttonHover: 'hover:bg-emerald-500',
    progressGradient: 'from-emerald-500 to-emerald-300',
    stroke: '#10b981',
    tickBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    tickText: 'text-emerald-400',
    underline: 'bg-emerald-400',
    borderHover: 'hover:border-emerald-500/70',
    coverGradient: 'from-emerald-900/90 via-[#0F1E36] to-[#0A1224]',
    iconBg: 'bg-emerald-500/20 text-emerald-300'
  },
  Indigo: {
    name: 'Indigo',
    label: 'Indigo',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/40',
    accentText: 'text-indigo-400',
    accentBorder: 'border-indigo-500/50',
    accentBg: 'bg-indigo-500',
    accentBgSubtle: 'bg-indigo-950/40',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-500',
    buttonHover: 'hover:bg-indigo-500',
    progressGradient: 'from-indigo-500 to-indigo-300',
    stroke: '#6366f1',
    tickBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
    tickText: 'text-indigo-400',
    underline: 'bg-indigo-400',
    borderHover: 'hover:border-indigo-500/70',
    coverGradient: 'from-indigo-900/90 via-[#0F1E36] to-[#0A1224]',
    iconBg: 'bg-indigo-500/20 text-indigo-300'
  },
  Sky: {
    name: 'Sky',
    label: 'Sky',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    badgeBorder: 'border-sky-500/40',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/50',
    accentBg: 'bg-sky-500',
    accentBgSubtle: 'bg-sky-950/40',
    buttonBg: 'bg-sky-600 hover:bg-sky-500',
    buttonHover: 'hover:bg-sky-500',
    progressGradient: 'from-sky-500 to-sky-300',
    stroke: '#0284c7',
    tickBg: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
    tickText: 'text-sky-400',
    underline: 'bg-sky-400',
    borderHover: 'hover:border-sky-500/70',
    coverGradient: 'from-sky-900/90 via-[#0F1E36] to-[#0A1224]',
    iconBg: 'bg-sky-500/20 text-sky-300'
  },
  Amber: {
    name: 'Amber',
    label: 'Amber',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/40',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/50',
    accentBg: 'bg-amber-500',
    accentBgSubtle: 'bg-amber-950/40',
    buttonBg: 'bg-amber-600 hover:bg-amber-500',
    buttonHover: 'hover:bg-amber-500',
    progressGradient: 'from-amber-500 to-amber-300',
    stroke: '#f59e0b',
    tickBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
    tickText: 'text-amber-400',
    underline: 'bg-amber-400',
    borderHover: 'hover:border-amber-500/70',
    coverGradient: 'from-amber-900/90 via-[#0F1E36] to-[#0A1224]',
    iconBg: 'bg-amber-500/20 text-amber-300'
  },
  Rose: {
    name: 'Rose',
    label: 'Rose',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/40',
    accentText: 'text-rose-400',
    accentBorder: 'border-rose-500/50',
    accentBg: 'bg-rose-500',
    accentBgSubtle: 'bg-rose-950/40',
    buttonBg: 'bg-rose-600 hover:bg-rose-500',
    buttonHover: 'hover:bg-rose-500',
    progressGradient: 'from-rose-500 to-rose-300',
    stroke: '#f43f5e',
    tickBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
    tickText: 'text-rose-400',
    underline: 'bg-rose-400',
    borderHover: 'hover:border-rose-500/70',
    coverGradient: 'from-rose-900/90 via-[#0F1E36] to-[#0A1224]',
    iconBg: 'bg-rose-500/20 text-rose-300'
  }
};

export const ACCENT_COLOR_OPTIONS: CourseAccentColor[] = [
  'Teal',
  'Emerald',
  'Indigo',
  'Sky',
  'Amber',
  'Rose'
];

export function getCourseAccent(color?: CourseAccentColor | string): AccentTheme {
  if (color && color in COURSE_ACCENT_COLORS) {
    return COURSE_ACCENT_COLORS[color as CourseAccentColor];
  }
  return COURSE_ACCENT_COLORS.Teal;
}
