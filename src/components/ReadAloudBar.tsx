import React from 'react';
import { Volume2, Pause, Play, Square, SkipBack, SkipForward } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { SpeechSpeed } from '../types';
import { splitIntoSentences } from '../lib/speechUtils';

interface ReadAloudBarProps {
  sourceId: string;
  label?: string;
  blocks: string[];
  showParagraphNav?: boolean;
  compact?: boolean;
  className?: string;
}

export const ReadAloudBar: React.FC<ReadAloudBarProps> = ({
  sourceId,
  label = 'Listen',
  blocks,
  showParagraphNav = false,
  compact = false,
  className = ''
}) => {
  const {
    settings,
    updateSettings,
    isSpeaking,
    isPaused,
    activeSourceId,
    speakBlocks,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    nextParagraph,
    previousParagraph
  } = useAccessibility();

  if (!settings.readAloudEnabled && !settings.accessibilityMode) {
    return null;
  }

  const isThisPlaying = isSpeaking && activeSourceId === sourceId;

  const handleListen = () => {
    if (isThisPlaying) {
      if (isPaused) {
        resumeSpeech();
      } else {
        pauseSpeech();
      }
      return;
    }
    speakBlocks(sourceId, blocks, 0);
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      role="group"
      aria-label={`Read aloud controls for ${label}`}
    >
      <button
        type="button"
        onClick={handleListen}
        aria-label={isThisPlaying ? (isPaused ? `Resume ${label}` : `Pause ${label}`) : `${label}`}
        aria-pressed={isThisPlaying}
        className={`inline-flex items-center gap-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
          compact ? 'min-h-[40px] px-3 py-1.5 text-xs' : 'min-h-[48px] px-4 py-2 text-xs sm:text-sm'
        } ${
          isThisPlaying
            ? 'bg-[#FFC700] border-[#FFC700] text-[#0A1224]'
            : 'bg-[#121C36] border-[#24315A] hover:border-[#FFC700] text-[#FFC700]'
        }`}
      >
        {isThisPlaying ? (
          isPaused ? (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </>
          )
        ) : (
          <>
            <Volume2 className="w-4 h-4" />
            <span>{label}</span>
          </>
        )}
      </button>

      {isThisPlaying && (
        <>
          {showParagraphNav && (
            <>
              <button
                type="button"
                onClick={previousParagraph}
                aria-label="Previous paragraph"
                className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-xs font-bold text-[#E6ECFA] flex items-center justify-center cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextParagraph}
                aria-label="Next paragraph"
                className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-xs font-bold text-[#E6ECFA] flex items-center justify-center cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={stopSpeech}
            aria-label="Stop reading"
            className="min-h-[44px] px-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>

          <div className="inline-flex items-center rounded-xl bg-[#0A1224] border border-[#24315A] p-0.5">
            {(['slow', 'normal', 'fast'] as SpeechSpeed[]).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => updateSettings({ speechSpeed: spd })}
                aria-label={`Set speech speed to ${spd}`}
                aria-pressed={settings.speechSpeed === spd}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${
                  settings.speechSpeed === spd
                    ? 'bg-[#2F52FF] text-white'
                    : 'text-[#9AA8C7] hover:text-white'
                }`}
              >
                {spd}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface SentenceHighlightTextProps {
  text: string;
  sourceId: string;
  blockIndex?: number;
  className?: string;
}

/**
 * Renders plain text with live highlighting on the exact sentence currently being read aloud.
 */
export const SentenceHighlightText: React.FC<SentenceHighlightTextProps> = ({
  text,
  sourceId,
  blockIndex = 0,
  className = ''
}) => {
  const { isSpeaking, activeSourceId, activeBlockIndex, activeSentenceIndex } = useAccessibility();

  const sentences = splitIntoSentences(text);
  const isBlockActive = isSpeaking && activeSourceId === sourceId && activeBlockIndex === blockIndex;

  if (!isBlockActive || sentences.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {sentences.map((sentence, idx) => (
        <React.Fragment key={idx}>
          <span className={idx === activeSentenceIndex ? 'tts-sentence-active' : undefined}>
            {sentence}
          </span>
          {idx < sentences.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </span>
  );
};
