"use client";

import React, { useState } from 'react';
import { parse as markedParse, setOptions as markedSetOptions } from 'marked';
import DOMPurify from 'dompurify';
import { Modal } from './ui/Modal';
import { Segmented } from './ui/Segmented';

// mangle/headerIds are deprecated in marked 5 and warn on every parse.
markedSetOptions({ mangle: false, headerIds: false });

export default function NewsPopup({
  isOpen,
  onClose,
  content,
}: {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}) {
  const [mode, setMode] = useState<'preview' | 'raw'>('preview');

  if (!isOpen) return null;

  const safeHtml = DOMPurify.sanitize(markedParse(content || '') as string);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="What's New"
      subtitle={
        <Segmented
          label="News display mode"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'preview', label: 'Preview' },
            { value: 'raw', label: 'Raw' },
          ]}
        />
      }
      size="lg"
    >
      {mode === 'raw' ? (
        <pre
          data-testid="news-raw-content"
          className="whitespace-pre-wrap break-words p-5 font-mono text-[12.5px] text-[var(--text-muted)]"
        >
          {content}
        </pre>
      ) : (
        <div
          data-testid="news-preview-content"
          className="news-preview p-5"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )}
    </Modal>
  );
}
