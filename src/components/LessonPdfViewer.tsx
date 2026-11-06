/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, FileText, Maximize2 } from 'lucide-react';
import { formatPdfUrl, getPdfDownloadUrl } from '../data/coursesAndTimetables';

interface LessonPdfViewerProps {
  pdfUrl: string;
  topicTitle: string;
}

export const LessonPdfViewer: React.FC<LessonPdfViewerProps> = ({ pdfUrl, topicTitle }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const embedUrl = formatPdfUrl(pdfUrl);
  const downloadUrl = getPdfDownloadUrl(pdfUrl);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(160, prev + 15));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(70, prev - 15));
  const handleResetZoom = () => setZoomLevel(100);

  return (
    <div className="rounded-2xl bg-[#111A2E] border border-[#24315A] overflow-hidden shadow-md space-y-0">
      {/* Viewer Toolbar */}
      <div className="p-3 bg-[#0B1220] border-b border-[#24315A] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-heading font-bold text-xs text-[#E8EEF8] truncate block">
              Notes PDF Document
            </span>
            <span className="text-[10px] text-[#9FB0C8] truncate block">
              Google Drive / PDF Reader
            </span>
          </div>
        </div>

        {/* Action Controls: Zoom, Open, Download */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center bg-[#16223A] border border-[#24315A] rounded-lg p-0.5 text-xs text-[#9FB0C8]">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:text-white cursor-pointer transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[11px] font-bold text-[#E8EEF8] hover:text-[#FACC15] cursor-pointer"
              title="Reset zoom"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:text-white cursor-pointer transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Open external */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-[#16223A] border border-[#24315A] text-[#E8EEF8] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3 text-[#9FB0C8]" />
          </a>

          {/* Download button */}
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Frame Container with zoom transform */}
      <div className="relative w-full bg-[#0B1220] overflow-auto h-[620px] max-h-[75vh]">
        <div
          className="w-full h-full transition-transform duration-200 origin-top"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            width: zoomLevel !== 100 ? `${100 * (100 / zoomLevel)}%` : '100%',
            height: zoomLevel !== 100 ? `${100 * (100 / zoomLevel)}%` : '100%'
          }}
        >
          <iframe
            src={embedUrl}
            title={`${topicTitle} PDF Notes`}
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
};
