import React, { useState } from 'react';
import { SITE_CONFIG } from '../config/site';
import { db, safeAddDoc as addDoc, cleanFirestoreData } from '../lib/firebase';
import { collection } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { MessageType, ContactMessage } from '../types';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { WhatsAppChannelButton } from './WhatsAppChannelButton';
import {
  Send,
  CheckCircle2,
  Phone,
  Mail,
  User,
  MapPin,
  Clock,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();

  const [name, setName] = useState(profile?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [type, setType] = useState<MessageType>('Enquiry');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please provide your name, email, and message details.');
      return;
    }

    setLoading(true);
    const studentUid = user?.uid || profile?.uid || '';
    const newMsg: Omit<ContactMessage, 'id'> = {
      name: name.trim(),
      email: email.trim(),
      type,
      message: message.trim(),
      status: 'New',
      userId: studentUid,
      uid: studentUid,
      createdAt: new Date().toISOString()
    };

    try {
      // Save to Firestore
      try {
        await addDoc(collection(db, 'messages'), cleanFirestoreData(newMsg));
      } catch (err) {
        console.warn('Firestore message save note:', err);
      }

      // Also persist to local messages storage
      const existing = JSON.parse(localStorage.getItem('sot_local_messages') || '[]');
      const savedMsg = { ...newMsg, id: 'msg_' + Date.now() };
      localStorage.setItem('sot_local_messages', JSON.stringify([savedMsg, ...existing]));

      setSubmitted(true);
      setMessage('');
    } catch (err: any) {
      console.warn('Contact submission notice:', err?.message || err);
      setError('Could not deliver message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-16 md:py-24 bg-[#0A1224] text-[#E6ECFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#FFC700]">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Student Union Helpdesk</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-[#E6ECFA]">
            Contact Student Representatives
          </h1>
          <p className="text-sm sm:text-base text-[#9AA8C7]">
            Have a question, feedback, or a complaint regarding the student portal or course listings? Submit your message directly to our student desk.
          </p>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Representative Information Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-7 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-6 shadow-[0_0_30px_rgba(47,82,255,0.08)]">
              
              <div className="border-b border-[#24315A] pb-4">
                <span className="text-xs font-bold text-[#FFC700] uppercase tracking-wider block">
                  Lead Student Representative
                </span>
                <h2 className="font-display font-bold text-xl text-[#E6ECFA] mt-1">
                  {SITE_CONFIG.contact.representativeName}
                </h2>
                <p className="text-xs text-[#9AA8C7] mt-0.5">School of Technology Student Desk</p>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0">
                    <Phone className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-bold text-[#9AA8C7]">Phone / WhatsApp</h3>
                    <a
                      href={`tel:${SITE_CONFIG.contact.phone}`}
                      className="text-sm font-semibold text-[#E6ECFA] hover:text-[#FFC700] transition-colors"
                    >
                      {SITE_CONFIG.contact.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-bold text-[#9AA8C7]">Email Address</h3>
                    <a
                      href={`mailto:${SITE_CONFIG.contact.email}`}
                      className="text-sm font-semibold text-[#E6ECFA] hover:text-[#FFC700] transition-colors"
                    >
                      {SITE_CONFIG.contact.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-bold text-[#9AA8C7]">Desk Location</h3>
                    <p className="text-xs text-[#E6ECFA] mt-0.5">
                      {SITE_CONFIG.contact.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0A1224] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase font-bold text-[#9AA8C7]">Student Desk Hours</h3>
                    <p className="text-xs text-[#E6ECFA] mt-0.5">
                      {SITE_CONFIG.contact.officeHours}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] leading-relaxed">
                <span className="text-[#FFC700] font-semibold block mb-1">Peer Support Note:</span>
                Messages are routed to the student committee inbox and portal administrators. We aim to respond within 24–48 hours.
              </div>

              {settings.whatsappChannelUrl && (
                <div className="pt-1">
                  <WhatsAppChannelButton
                    url={settings.whatsappChannelUrl}
                    variant="banner"
                    className="w-full"
                  />
                </div>
              )}

            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7">
            <div className="p-7 sm:p-9 rounded-2xl bg-[#121C36] border border-[#24315A] shadow-[0_0_30px_rgba(0,0,0,0.4)]">
              
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#0A1224] border border-[#FFC700] flex items-center justify-center text-[#FFC700] mx-auto shadow-[0_0_25px_rgba(255,199,0,0.3)]">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h2 className="font-display font-bold text-2xl text-[#E6ECFA]">
                    Thank You for Reaching Out!
                  </h2>
                  <p className="text-sm text-[#9AA8C7] max-w-md mx-auto leading-relaxed">
                    Your message has been received by our student editorial team. We will review it promptly and get back to you at <span className="text-[#FFC700] font-semibold">{email}</span>.
                  </p>
                  {user && (
                    <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] max-w-md mx-auto flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#FFC700] shrink-0" aria-hidden="true" />
                      <span>You can track this message status and admin replies in your dashboard under <strong>"My Messages"</strong>.</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 min-h-[48px] px-6 py-2.5 rounded-xl text-xs font-bold bg-[#2F52FF] text-white hover:bg-[#2545df] cursor-pointer shadow-[0_0_15px_rgba(47,82,255,0.3)]"
                  >
                    Submit Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="font-display font-bold text-xl text-[#E6ECFA] mb-2">
                    Send a Message to the Student Desk
                  </h2>

                  {error && (
                    <div role="alert" className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contactNameInput" className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        id="contactNameInput"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="contactEmailInput" className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                        Your Email Address *
                      </label>
                      <input
                        id="contactEmailInput"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="student@example.com"
                        className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <span id="contactTypeLabel" className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                      Message Classification *
                    </span>
                    <div role="group" aria-labelledby="contactTypeLabel" className="grid grid-cols-3 gap-3">
                      {(['Complaint', 'Review', 'Enquiry'] as MessageType[]).map((t) => (
                        <button
                          type="button"
                          key={t}
                          aria-pressed={type === t}
                          onClick={() => setType(t)}
                          className={`min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            type === t
                              ? 'bg-[#2F52FF] text-white border-[#2F52FF] shadow-[0_0_15px_rgba(47,82,255,0.3)]'
                              : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A] hover:text-[#E6ECFA]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contactMessageInput" className="block text-xs font-semibold text-[#9AA8C7] mb-1.5">
                      Your Message *
                    </label>
                    <textarea
                      id="contactMessageInput"
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please state your inquiry, review, or complaint in detail..."
                      className="w-full px-4 py-2.5 rounded-lg bg-[#0A1224] border border-[#24315A] text-[#E6ECFA] placeholder-[#9AA8C7]/50 text-sm focus:outline-none focus:border-[#2F52FF] focus:ring-2 focus:ring-[#2F52FF]/40 focus:shadow-[0_0_15px_rgba(47,82,255,0.25)] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] py-3.5 rounded-xl text-sm font-bold bg-[#FFC700] text-[#0A1224] hover:bg-[#ffd233] transition-all shadow-[0_0_25px_rgba(255,199,0,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-[#0A1224]" aria-hidden="true" />
                    <span>{loading ? 'Submitting Message...' : 'Transmit Message to Student Desk'}</span>
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
