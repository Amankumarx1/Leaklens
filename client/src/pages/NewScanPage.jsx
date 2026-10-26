import React, { useState, useRef } from 'react';
import { uploadAndScanFile } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const ALLOWED_EXTS = [
  '.txt', '.json', '.csv', '.env', '.log', '.yaml', '.yml',
  '.ini', '.cfg', '.conf', '.xml', '.md',
  '.js', '.ts', '.py', '.java', '.go', '.sh', '.sql'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function NewScanPage({ user, onNavigate }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [serverError, setServerError] = useState(null);

  const fileInputRef = useRef(null);

  // Check if role is forbidden
  if (user?.role === 'COMPLIANCE_REVIEWER') {
    return (
      <div className="panel" style={{ borderColor: 'var(--status-warning)' }}>
        <div className="panel-header">
          <h3>Access Restricted</h3>
          <StatusBadge type="warning">COMPLIANCE REVIEWER</StatusBadge>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
          Compliance Reviewers possess read-only audit visibility and are restricted by policy from uploading files or triggering scanning operations. Please contact a Security Administrator or Lead Analyst if a file inspection is required.
        </p>
        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => onNavigate('scans')}>
          ← Return to Scans Log
        </button>
      </div>
    );
  }

  const validateAndSelectFile = (file) => {
    setValidationError(null);
    setServerError(null);
    setScanResult(null);

    if (!file) return;

    // Check extension
    const name = file.name.toLowerCase();
    const hasAllowedExt = ALLOWED_EXTS.some(ext => name.endsWith(ext));
    if (!hasAllowedExt) {
      setValidationError(`Unsupported file format. Please upload a plain text (.txt), JSON (.json), or CSV (.csv) file.`);
      setSelectedFile(null);
      return;
    }

    // Check size limit
    if (file.size > MAX_FILE_SIZE) {
      setValidationError(`File exceeds maximum permitted limit of 5 MB (selected: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setValidationError(`The selected file is empty.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationError(null);
    setServerError(null);
    setScanResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setServerError(null);
    setScanResult(null);

    try {
      const res = await uploadAndScanFile(selectedFile);
      if (res?.success) {
        setScanResult(res.data);
      }
    } catch (err) {
      setServerError(err.message || 'Scan execution failed. Please verify file format.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Initiate Authorized File Scan</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Upload authorized files to evaluate against enabled credential, API key, and secret markers.
            </p>
          </div>
          <StatusBadge type="info">Max 5 MB</StatusBadge>
        </div>

        {/* Success Confirmation State */}
        {scanResult ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'var(--glass-blur-heavy)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: 'var(--shadow-glass)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span className="health-dot healthy" style={{ width: '12px', height: '12px' }} />
              <h4 style={{ fontSize: '16px', color: 'var(--status-healthy)', fontWeight: '700' }}>
                Scan Completed & Persisted Successfully
              </h4>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div><strong>Scan Identifier:</strong> <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{scanResult.scan_id}</code></div>
              <div><strong>File:</strong> {scanResult.file?.original_filename} ({(scanResult.file?.file_size_bytes / 1024).toFixed(1)} KB)</div>
              <div><strong>SHA-256 Digest:</strong> <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{scanResult.file?.content_hash}</code></div>
              <div>
                <strong>Findings Detected:</strong>{' '}
                <StatusBadge type={scanResult.summary?.total_findings > 0 ? 'warning' : 'healthy'}>
                  {scanResult.summary?.total_findings || 0} EXPOSURES
                </StatusBadge>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('scan-detail', scanResult.scan_id)}
              >
                Inspect Scan Results & Findings →
              </button>
              <button className="btn btn-secondary" onClick={handleReset}>
                Scan Another File
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'rgba(203, 213, 225, 0.9)'}`,
                borderRadius: 'var(--radius-xl)',
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: isDragging ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'var(--glass-blur-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                marginBottom: '20px',
                boxShadow: 'var(--shadow-glass-sm)'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,.csv,.env,.log,.yaml,.yml,.ini,.cfg,.conf,.xml,.md,.js,.ts,.py,.java,.go,.sh,.sql"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ color: 'var(--accent-cyan)', marginBottom: '12px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="44" height="44" style={{ margin: '0 auto' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>
                {selectedFile ? selectedFile.name : 'Click to select or drag and drop a file'}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Supported formats: <strong>.txt, .json, .csv, .env, .log, .yaml, .ini, .xml, .md</strong>, and source code files
              </p>
            </div>

            {/* Validation or Server Errors */}
            {(validationError || serverError) && (
              <div style={{
                backgroundColor: 'var(--status-danger-bg)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                marginBottom: '20px'
              }}>
                {validationError || serverError}
              </div>
            )}

            {/* Selected File Metadata Card */}
            {selectedFile && !validationError && (
              <div style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedFile.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Size: {(selectedFile.size / 1024).toFixed(1)} KB | Type: {selectedFile.type || 'text/plain'}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={uploading}
                onClick={() => onNavigate('scans')}
              >
                Cancel
              </button>

              <button
                id="btn-start-scan"
                type="submit"
                className="btn btn-primary"
                disabled={!selectedFile || uploading || !!validationError}
              >
                {uploading ? 'Scanning & Masking File...' : 'Start Inspection Scan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default NewScanPage;
