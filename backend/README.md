# Backend - FastAPI

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
uvicorn main:app --reload --port 8001
```

The API will be available at http://localhost:8001

## API Endpoints

- `POST /api/upload` - Upload CSV file (returns SSE stream for progress)
- `GET /api/products` - Get products with filtering and pagination
- `GET /api/products/{id}` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Delete product
- `DELETE /api/products` - Delete all products

