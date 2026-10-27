import React from 'react';
import { TimetableEntry } from '../types';
import { Calendar, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { getLagosDateString } from './StudentDashboard';

interface ExamCountdownCardProps {
  department: string;
  timetables: TimetableEntry[];
  onViewTimetable?: () => void;
}

export const ExamCountdownCard: React.FC<ExamCountdownCardProps> = ({
  department,
  timetables,
  onViewTimetable
}) => {
  const todayStr = getLagosDateString();
  const todayDate = new Date(todayStr);

  // Find all exam entries for this department that have a date
  const examEntries = timetables
    .filter(t => t.department === department && t.type === 'exam' && !!t.date)
    .map(t => {
      const examDate = new Date(t.date!);
      const diffMs = examDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { entry: t, examDate, diffDays };
    })
    .filter(e => e.diffDays >= 0)
    .sort((a, b) => a.diffDays - b.diffDays);

  const nextExam = examEntries[0];

  if (!nextExam) {
    return (
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AA8C7] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Exam Countdown</span>
            </span>
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#0A1224] text-[#9AA8C7] border border-[#24315A]">
              Timetable
            </span>
          </div>
          <h4 className="font-heading font-bold text-sm text-[#E6ECFA]">
            Next Department Exam
          </h4>
          <p className="text-xs text-[#9AA8C7] leading-relaxed">
            No active examination schedules posted for {department} yet.
          </p>
        </div>

        {onViewTimetable && (
          <button
            onClick={onViewTimetable}
            className="text-left text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer"
          >
            Check Lectures &rarr;
          </button>
        )}
      </div>
    );
  }

  const { entry, diffDays } = nextExam;

  let countdownLabel = `${diffDays} days left`;
  let badgeColor = 'bg-[#2F52FF]/20 text-[#60A5FA] border-[#2F52FF]/40';

  if (diffDays === 0) {
    countdownLabel = 'Exam Today!';
    badgeColor = 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse';
  } else if (diffDays === 1) {
    countdownLabel = 'Tomorrow!';
    badgeColor = 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/40';
  } else if (diffDays <= 7) {
    badgeColor = 'bg-[#FFC700]/20 text-[#FFC700] border-[#FFC700]/40';
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col justify-between space-y-3 shadow-[0_0_15px_rgba(47,82,255,0.08)]">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AA8C7] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#FFC700]" />
            <span>Next Exam</span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {countdownLabel}
          </span>
        </div>

        <div>
          <h4 className="font-heading font-bold text-sm text-[#E6ECFA] truncate">
            {entry.courseCode}
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9AA8C7] mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#FFC700]" />
              <span>{entry.date}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#60A5FA]" />
              <span>{entry.startTime}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#9AA8C7] mt-0.5">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span className="truncate">{entry.venue}</span>
          </div>
        </div>
      </div>

      {onViewTimetable && (
        <button
          onClick={onViewTimetable}
          className="text-left text-xs font-semibold text-[#FFC700] hover:underline cursor-pointer pt-1 border-t border-[#24315A]/70"
        >
          View Full Schedule &rarr;
        </button>
      )}
    </div>
  );
};
