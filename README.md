# Acme Inc. - Product Management System

A full-stack web application for importing and managing products from CSV files. Built with React.js (frontend) and FastAPI (backend).

## Features

### Story 1 - File Upload via UI
- Upload large CSV files (up to 500,000 products) through the web interface
- Real-time progress tracking using Server-Sent Events (SSE)
- Automatic duplicate handling (overwrites based on case-insensitive SKU)
- Visual progress indicators (progress bar, percentage, status messages)

### Story 1A - Upload Progress Visibility
- Real-time progress updates during file processing
- Visual cues: progress bar, percentage, status badges
- Error handling with clear failure messages
- Retry capability

### Story 2 - Product Management UI
- View products with pagination
- Filter by SKU, name, active status, or description
- Create, update, and delete products
- Inline editing via modal forms
- Clean, minimalist design

### Story 3 - Bulk Delete
- Delete all products with a single action
- Confirmation dialog to prevent accidental deletion
- Success/failure notifications

## Project Structure

```
fulfil/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── products.db          # SQLite database (created on first run)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main app component
│   │   ├── FileUpload.jsx   # CSV upload component
│   │   ├── ProductList.jsx  # Product management component
│   │   ├── api.js           # API service functions
│   │   └── *.css            # Component styles
│   ├── package.json
│   └── vite.config.js
└── products.csv             # Sample CSV file
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
uvicorn main:app --reload --port 8001
```

The API will be available at `http://localhost:8001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5174`

## API Endpoints

- `POST /api/upload` - Upload CSV file (returns SSE stream)
- `GET /api/products` - Get products with filtering and pagination
  - Query params: `skip`, `limit`, `sku`, `name`, `active`, `description`
- `GET /api/products/{id}` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Delete product
- `DELETE /api/products` - Delete all products

## CSV Format

The CSV file should have the following columns:
- `name` (required)
- `sku` (required, unique, case-insensitive)
- `description` (optional)

Example:
```csv
name,sku,description
Product 1,SKU-001,Description of product 1
Product 2,SKU-002,Description of product 2
```

## Technical Details

- **Backend**: FastAPI with SQLAlchemy ORM, SQLite database
- **Frontend**: React with Vite
- **Progress Tracking**: Server-Sent Events (SSE)
- **Database**: SQLite (can be easily switched to PostgreSQL)
- **Batch Processing**: Products are processed in batches of 1000 for optimal performance

## Notes

- SKU is treated as case-insensitive and must be unique
- Duplicate SKUs in CSV will overwrite existing products
- Products can be marked as active/inactive
- The system is optimized for handling large datasets (500k+ records)

