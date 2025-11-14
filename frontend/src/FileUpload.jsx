import { useState } from 'react';
import { uploadCSV } from './api';
import './FileUpload.css';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a CSV file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setProgress(0);
    setStatus('uploading');
    setMessage('Starting upload...');
    setError('');

    try {
      await uploadCSV(file, (data) => {
        console.log('Progress update:', data); // Debug log
        const progressValue = data.progress !== undefined ? Math.round(data.progress * 100) / 100 : 0;
        const statusValue = data.status || 'processing';
        const messageValue = data.message || 'Processing...';
        
        // Only update if progress increases (prevent going backward)
        setProgress(prev => Math.max(prev, progressValue));
        setStatus(statusValue);
        setMessage(messageValue);
        
        if (data.status === 'complete') {
          setUploading(false);
          setStatus('complete');
          setProgress(100);
          setMessage(`Import complete! ${data.processed || 0} products processed.`);
          if (data.errors > 0) {
            setMessage(`Import complete with ${data.errors} errors. ${data.processed || 0} products processed.`);
          }
        } else if (data.status === 'error') {
          setUploading(false);
          setStatus('error');
          setError(data.message || 'Upload failed');
        }
      });
    } catch (err) {
      console.error('Upload error:', err);
      setUploading(false);
      setStatus('error');
      setError(err.message || 'Upload failed');
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploading(false);
    setProgress(0);
    setStatus('');
    setMessage('');
    setError('');
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="file-upload-container">
      <h2>Upload CSV File</h2>
      
      <div className="upload-section">
        <div className="file-input-wrapper">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={uploading}
            className="file-input"
          />
          {file && (
            <div className="file-info">
              <span>Selected: {file.name}</span>
              <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="upload-button"
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
          {status && (
            <button onClick={resetUpload} className="reset-button">
              Reset
            </button>
          )}
        </div>
      </div>

      {(uploading || status) && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div
              className={`progress-bar ${status}`}
              style={{ width: `${Math.max(progress, 1)}%` }}
            />
          </div>
          <div className="progress-info">
            <span className="progress-text">{message || `Processing... ${progress.toFixed(2)}%`}</span>
            <span className="progress-percent">{progress.toFixed(2)}%</span>
          </div>
          {status === 'parsing' && (
            <div className="status-badge parsing">Parsing CSV</div>
          )}
          {status === 'processing' && (
            <div className="status-badge processing">Processing</div>
          )}
          {status === 'uploading' && (
            <div className="status-badge complete">Uploading</div>
          )}
          {status === 'complete' && (
            <div className="status-badge complete">Complete</div>
          )}
          {status === 'error' && (
            <div className="status-badge error">Error</div>
          )}
        </div>
      )}
    </div>
  );
}

export default FileUpload;

