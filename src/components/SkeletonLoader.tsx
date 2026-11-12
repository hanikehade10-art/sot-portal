import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`relative overflow-hidden bg-[#152140] rounded-xl ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[#2F52FF]/15 to-transparent pointer-events-none" />
    </div>
  );
};

export const QuizCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-16 h-5 rounded-md" />
          <Skeleton className="w-20 h-5 rounded-md" />
        </div>
        <Skeleton className="w-12 h-4 rounded-md" />
      </div>

      <div className="space-y-1.5">
        <Skeleton className="w-3/4 h-5 rounded-md" />
        <Skeleton className="w-full h-3.5 rounded-md" />
        <Skeleton className="w-2/3 h-3.5 rounded-md" />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#24315A]/60">
        <div className="flex items-center gap-3">
          <Skeleton className="w-16 h-4 rounded-md" />
          <Skeleton className="w-14 h-4 rounded-md" />
        </div>
        <Skeleton className="w-24 h-8 rounded-xl" />
      </div>
    </div>
  );
};

export const QuizListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <QuizCardSkeleton key={idx} />
      ))}
    </div>
  );
};

export const LeaderboardSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-3.5 sm:p-4 rounded-2xl bg-[#121C36] border border-[#24315A] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="w-24 h-4 rounded-md" />
              <Skeleton className="w-16 h-3 rounded-md" />
            </div>
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="w-10 h-5 rounded-md ml-auto" />
            <Skeleton className="w-8 h-2.5 rounded-md ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ExamQuestionSkeleton: React.FC = () => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-4 rounded-md" />
        <Skeleton className="w-16 h-4 rounded-md" />
      </div>
      <Skeleton className="w-full h-12 rounded-xl" />
      <div className="space-y-2.5 pt-2">
        <Skeleton className="w-full h-11 rounded-xl" />
        <Skeleton className="w-full h-11 rounded-xl" />
        <Skeleton className="w-full h-11 rounded-xl" />
        <Skeleton className="w-full h-11 rounded-xl" />
      </div>
    </div>
  );
};

export const CourseCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="w-20 h-4 rounded-md" />
        </div>
        <Skeleton className="w-12 h-4 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="w-3/4 h-5 rounded-md" />
        <Skeleton className="w-1/2 h-3.5 rounded-md" />
      </div>
      <div className="pt-2 border-t border-[#24315A]/60 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="w-14 h-3 rounded-md" />
          <Skeleton className="w-8 h-3 rounded-md" />
        </div>
        <Skeleton className="w-full h-2 rounded-full" />
      </div>
    </div>
  );
};

export const CourseListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <CourseCardSkeleton key={idx} />
      ))}
    </div>
  );
};

