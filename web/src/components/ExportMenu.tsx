/**
 * ExportMenu — Phase 7 export/share actions.
 *
 * Explicit off-path actions — never affect interactive latency.
 */

import { useState, useRef } from 'react';
import { useStore } from '../state/store';
import {
  exportConfigJSON,
  exportDataCSV,
  encodeConfigToURL,
  importConfigJSON,
} from '../utils/exporters';
import './ExportMenu.css';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const solveResult = useStore((s) => s.solveResult);
  const forkRun = useStore((s) => s.forkRun);

  const run = getActiveRun();

  const handleExportConfig = () => {
    if (!run) return;
    exportConfigJSON(run.config);
    setOpen(false);
  };

  const handleExportCSV = () => {
    if (!solveResult) return;
    exportDataCSV(solveResult);
    setOpen(false);
  };

  const handleShare = () => {
    if (!run) return;
    const url = encodeConfigToURL(run.config);
    if (!url) {
      setShareUrl('Config too large for URL — export JSON instead');
    } else {
      setShareUrl(url);
      navigator.clipboard?.writeText(url);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const { config, error } = importConfigJSON(reader.result as string);
      if (error) {
        setImportError(error);
        return;
      }
      if (config && run) {
        forkRun(run.id, config);
        setImportError('');
        setOpen(false);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="export-menu-container">
      <button className="toolbar-btn" onClick={() => setOpen(!open)}>
        Export
      </button>

      {open && (
        <div className="export-dropdown">
          <button className="export-item" onClick={handleExportConfig}>
            Export Config (JSON)
          </button>
          <button
            className="export-item"
            onClick={handleExportCSV}
            disabled={!solveResult}
          >
            Export Data (CSV)
            {!solveResult && <span className="export-note">Solve first</span>}
          </button>
          <button className="export-item" onClick={handleImport}>
            Import Config (JSON)
          </button>
          <div className="export-divider" />
          <button className="export-item" onClick={handleShare}>
            Copy Share Link
          </button>
          {shareUrl && (
            <div className="export-share-url">{shareUrl}</div>
          )}
          {importError && (
            <div className="export-error">{importError}</div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
}
