const API_BASE_URL = 'http://localhost:8001/api';

export const uploadCSV = async (file, onProgress) => {
  console.log('uploadCSV called with XMLHttpRequest version');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    console.log('Starting upload, file size:', file.size);

    // Send immediate progress update
    if (onProgress) {
      onProgress({
        status: 'uploading',
        progress: 0.1,
        message: `Starting upload... ${(file.size / (1024 * 1024)).toFixed(1)} MB`
      });
    }

    // Track upload timing and progress
    let uploadStartTime = Date.now();
    let lastProgress = 0;

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      console.log('Upload progress event:', e.loaded, '/', e.total);
      if (e.lengthComputable) {
        const uploadProgress = Math.min((e.loaded / e.total) * 50, 50); // First 50% is upload
        lastProgress = uploadProgress;
        console.log('Calling onProgress with:', uploadProgress);
        if (onProgress) {
          onProgress({
            status: 'uploading',
            progress: Math.round(uploadProgress * 100) / 100, // Round to 2 decimals
            message: `Uploading file... ${(e.loaded / (1024 * 1024)).toFixed(1)} MB / ${(e.total / (1024 * 1024)).toFixed(1)} MB`
          });
        }
      }
    });
    
    // Also track loadstart
    xhr.upload.addEventListener('loadstart', (e) => {
      console.log('Upload started');
      uploadStartTime = Date.now();
      
      // Show activity indicator since progress events may be slow
      const activityTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - uploadStartTime) / 1000);
        if (xhr.readyState !== 4) { // Still uploading
          if (onProgress) {
            onProgress({
              status: 'uploading',
              progress: Math.max(lastProgress, 0.5),
              message: `Uploading... ${elapsed}s elapsed (86.4 MB file, ~2-3 min expected)`
            });
          }
        } else {
          clearInterval(activityTimer);
        }
      }, 1000); // Update every second
      
      if (onProgress) {
        onProgress({
          status: 'uploading',
          progress: 0.5,
          message: 'Upload in progress...'
        });
      }
    });

    // Track response as it streams in
    let responseBuffer = '';
    xhr.addEventListener('progress', (e) => {
      // Response is streaming in
      if (xhr.readyState === 3 && xhr.responseText) {
        const newText = xhr.responseText.substring(responseBuffer.length);
        responseBuffer = xhr.responseText;
        
        // Process new SSE data
        const lines = newText.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            processSSELine(line.trim(), onProgress);
          }
        }
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Process any remaining response
        if (xhr.responseText) {
          const newText = xhr.responseText.substring(responseBuffer.length);
          responseBuffer = xhr.responseText;
          
          const lines = newText.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              processSSELine(line.trim(), onProgress);
            }
          }
        }
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText || xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', `${API_BASE_URL}/upload`);
    xhr.send(formData);
  });
};

const processSSELine = (line, onProgress) => {
  if (line.startsWith('data: ')) {
    try {
      const jsonStr = line.substring(6).trim();
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        // Round progress to 2 decimal places
        if (data.progress !== undefined) {
          data.progress = Math.round(data.progress * 100) / 100;
        }
        if (onProgress) {
          onProgress(data);
        }
      }
    } catch (e) {
      console.error('Error parsing SSE data:', e, 'Line:', line);
    }
  }
};

const processSSEResponse = (text, onProgress) => {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      processSSELine(line.trim(), onProgress);
    }
  }
};

export const uploadCSV_OLD = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode chunk and add to buffer
    buffer += decoder.decode(value, { stream: true });
    
    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim() === '') continue;
      
      if (line.startsWith('data: ')) {
        try {
          const jsonStr = line.substring(6).trim();
          if (jsonStr) {
            const data = JSON.parse(jsonStr);
            if (onProgress) {
              onProgress(data);
            }
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e, 'Line:', line);
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    if (buffer.startsWith('data: ')) {
      try {
        const jsonStr = buffer.substring(6).trim();
        if (jsonStr) {
          const data = JSON.parse(jsonStr);
          if (onProgress) {
            onProgress(data);
          }
        }
      } catch (e) {
        console.error('Error parsing final SSE data:', e);
      }
    }
  }
};

export const getProducts = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.skip !== undefined) queryParams.append('skip', params.skip);
  if (params.limit !== undefined) queryParams.append('limit', params.limit);
  if (params.sku) queryParams.append('sku', params.sku);
  if (params.name) queryParams.append('name', params.name);
  if (params.active !== undefined && params.active !== null) queryParams.append('active', params.active);
  if (params.description) queryParams.append('description', params.description);

  const response = await fetch(`${API_BASE_URL}/products?${queryParams}`);
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  return response.json();
};

export const getProduct = async (id) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }
  return response.json();
};

export const createProduct = async (product) => {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create product');
  }
  return response.json();
};

export const updateProduct = async (id, product) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update product');
  }
  return response.json();
};

export const deleteProduct = async (id) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete product');
  }
  return response.json();
};

export const deleteAllProducts = async () => {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete all products');
  }
  return response.json();
};

export const deleteMultipleProducts = async (productIds) => {
  const response = await fetch(`${API_BASE_URL}/products/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ product_ids: productIds }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete selected products');
  }
  return response.json();
};

