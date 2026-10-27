import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { StudyPlannerTask } from '../types';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  ListTodo,
  AlertCircle
} from 'lucide-react';

export const StudyPlanner: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [tasks, setTasks] = useState<StudyPlannerTask[]>(profile?.studyPlanner || []);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync with profile changes
  React.useEffect(() => {
    if (profile?.studyPlanner) {
      setTasks(profile.studyPlanner);
    }
  }, [profile?.studyPlanner]);

  const saveTasksToFirestore = async (updated: StudyPlannerTask[]) => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        studyPlanner: updated
      });
      await refreshProfile();
    } catch (err) {
      console.error('Failed to save study planner:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: StudyPlannerTask = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      courseCode: newCourseCode.trim().toUpperCase() || undefined,
      dueDate: newDueDate || undefined,
      done: false,
      createdAt: new Date().toISOString()
    };

    const nextList = [newTask, ...tasks];
    setTasks(nextList);
    setNewTitle('');
    setNewCourseCode('');
    setNewDueDate('');
    await saveTasksToFirestore(nextList);
  };

  const handleToggleTask = async (id: string) => {
    const nextList = tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t));
    setTasks(nextList);
    await saveTasksToFirestore(nextList);
  };

  const handleDeleteTask = async (id: string) => {
    const nextList = tasks.filter(t => t.id !== id);
    setTasks(nextList);
    await saveTasksToFirestore(nextList);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.done;
    if (filter === 'completed') return t.done;
    return true;
  });

  const completedCount = tasks.filter(t => t.done).length;
  const pendingCount = tasks.length - completedCount;

  return (
    <div className="space-y-4">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl text-[#E6ECFA] flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-[#FFC700]" />
            <span>Study Planner & To-Do</span>
          </h2>
          <p className="text-xs text-[#9AA8C7] mt-0.5">
            Organize assignments, lab reports, and exam prep tasks across your courses.
          </p>
        </div>

        {/* Counts Badges */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
            <strong className="text-[#FFC700]">{pendingCount}</strong> Pending
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#121C36] border border-[#24315A] text-[#9AA8C7]">
            <strong className="text-emerald-400">{completedCount}</strong> Done
          </span>
        </div>
      </div>

      {/* Add New Task Form */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#24315A]">
        <form onSubmit={handleAddTask} className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            required
            placeholder="What do you need to study or submit? *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
          />

          <input
            type="text"
            placeholder="Course (e.g. COM 111)"
            value={newCourseCode}
            onChange={(e) => setNewCourseCode(e.target.value)}
            className="w-32 px-3 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#FFC700] font-bold placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF]"
          />

          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] focus:outline-none focus:border-[#2F52FF]"
          />

          <button
            type="submit"
            disabled={saving || !newTitle.trim()}
            className="px-4 py-2 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(47,82,255,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#24315A] pb-2 text-xs">
        <div className="flex items-center gap-1.5">
          {(['all', 'pending', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg font-semibold capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-[#2F52FF] text-white'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-[#9AA8C7]">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#9AA8C7] space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#FFC700] mx-auto opacity-70" />
          <p className="font-medium text-[#E6ECFA]">
            {filter === 'completed'
              ? 'No completed tasks yet.'
              : filter === 'pending'
              ? 'No pending tasks. You are all caught up!'
              : 'Your study planner is empty. Add your first study task above!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                task.done
                  ? 'bg-[#0A1224]/60 border-[#24315A]/60 opacity-60'
                  : 'bg-[#121C36] border-[#24315A] hover:border-[#2F52FF]/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="text-[#FFC700] hover:text-[#ffd233] transition-colors cursor-pointer shrink-0"
                >
                  {task.done ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Square className="w-5 h-5 text-[#9AA8C7]" />
                  )}
                </button>

                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold truncate ${
                      task.done ? 'line-through text-[#9AA8C7]' : 'text-[#E6ECFA]'
                    }`}
                  >
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#9AA8C7] mt-0.5">
                    {task.courseCode && (
                      <span className="font-bold text-[#FFC700]">
                        {task.courseCode}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-[#60A5FA]">
                        <Calendar className="w-3 h-3" />
                        <span>Due {task.dueDate}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteTask(task.id)}
                title="Delete task"
                className="p-1.5 text-[#9AA8C7] hover:text-rose-400 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
