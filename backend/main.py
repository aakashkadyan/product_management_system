from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, String, Boolean, Integer, func, desc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import Optional, List
import csv
import io
import json

# Patch Starlette's Request to allow larger file uploads (up to 200MB)
from starlette.requests import Request
Request.max_request_body_size = 200 * 1024 * 1024  # 200MB

# Database setup - PostgreSQL
# TODO: UPDATE THESE CREDENTIALS WITH YOUR POSTGRESQL CREDENTIALS
import os

# PostgreSQL credentials
POSTGRES_USER = "aakash"
POSTGRES_PASSWORD = ""  # Using peer authentication (no password needed)
POSTGRES_HOST = "localhost"
POSTGRES_PORT = "5432"
POSTGRES_DB = "products"

# Build connection string - no password needed for peer authentication
SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}@/{POSTGRES_DB}"
print(f"Connecting to PostgreSQL: {POSTGRES_USER}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Model - using your existing table name
class Product(Base):
    __tablename__ = "product_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    sku = Column(String, unique=True, nullable=False, index=True)
    description = Column(String)
    active = Column(Boolean, default=True)

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic models
class ProductCreate(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    description: Optional[str]
    active: bool
    
    class Config:
        from_attributes = True

class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    skip: int
    limit: int

# FastAPI app
app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Product Management API"}

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload CSV file and import products with progress tracking via SSE"""
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Log that we received the request (file upload is complete at this point)
    print(f"Upload endpoint called for file: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    # Return streaming response immediately - this allows progress updates
    async def event_generator():
        import asyncio
        import traceback
        
        try:
            print("Starting event generator...")
            # Send initial status IMMEDIATELY - this is critical for the frontend to know the connection is working
            first_message = f"data: {json.dumps({'status': 'parsing', 'progress': 0, 'message': 'Upload received, starting processing...'})}\n\n"
            yield first_message
            print("Sent first message")
            await asyncio.sleep(0.001)  # Tiny delay to ensure flush
            
            # Read file content - FastAPI buffers the file, so read it directly
            yield f"data: {json.dumps({'status': 'parsing', 'progress': 1, 'message': 'Reading file from server...'})}\n\n"
            await asyncio.sleep(0.001)
            
            # Read the entire file (FastAPI already has it buffered)
            yield f"data: {json.dumps({'status': 'parsing', 'progress': 2, 'message': 'Reading file data...'})}\n\n"
            content = await file.read()
            file_size_mb = len(content) / (1024 * 1024)
            
            yield f"data: {json.dumps({'status': 'parsing', 'progress': 4, 'message': f'File read: {file_size_mb:.1f} MB'})}\n\n"
            await asyncio.sleep(0.001)
            
            yield f"data: {json.dumps({'status': 'parsing', 'progress': 5, 'message': 'Decoding file content...'})}\n\n"
            await asyncio.sleep(0.001)
            text_content = content.decode('utf-8')
            
            yield f"data: {json.dumps({'status': 'parsing', 'progress': 8, 'message': 'Parsing CSV structure...'})}\n\n"
            csv_reader = csv.DictReader(io.StringIO(text_content))
            
            db = SessionLocal()
            total_rows = 0
            processed = 0
            errors = []
            
            # Process rows directly without loading all into memory first
            yield f"data: {json.dumps({'status': 'parsing', 'progress': 10, 'message': 'Starting to process rows...'})}\n\n"
            await asyncio.sleep(0.001)
            
            # Estimate total rows from file size (rough estimate: ~450 bytes per row)
            file_size = len(content)
            estimated_total = max(file_size // 450, 1000)  # At least 1000 rows
            print(f"File size: {file_size} bytes, estimated rows: {estimated_total}")
            
            # Process rows in batches directly from CSV reader
            batch_size = 500  # Smaller batches for more frequent updates
            batch_skus = {}
            batch_count = 0
            
            for row in csv_reader:
                try:
                    sku = row.get('sku', '').strip().lower()
                    name = row.get('name', '').strip()
                    description = row.get('description', '').strip()
                    
                    if not sku:
                        errors.append(f"Row {processed + 1}: Missing SKU")
                        processed += 1
                        continue
                    
                    # Check if we've already processed this SKU in the current batch
                    if sku in batch_skus:
                        # Update the product we're tracking in this batch
                        existing_in_batch = batch_skus[sku]
                        existing_in_batch.name = name
                        existing_in_batch.description = description
                        existing_in_batch.active = True
                        processed += 1
                        continue
                    
                    # Check if product exists in database (case-insensitive SKU)
                    existing = db.query(Product).filter(func.lower(Product.sku) == sku).first()
                    
                    if existing:
                        # Update existing product
                        existing.name = name
                        existing.description = description
                        existing.active = True
                        batch_skus[sku] = existing  # Track it for this batch
                    else:
                        # Create new product
                        new_product = Product(
                            name=name,
                            sku=sku,
                            description=description,
                            active=True
                        )
                        db.add(new_product)
                        batch_skus[sku] = new_product  # Track it for this batch
                    
                    processed += 1
                    batch_count += 1
                    
                    # Commit and send progress after each batch
                    if batch_count >= batch_size:
                        db.commit()
                        batch_skus = {}  # Clear batch tracking
                        batch_count = 0
                        
                        # Calculate progress: 50% (upload done) + up to 49% for processing (cap at 99%)
                        processing_progress = min((processed / estimated_total) * 49, 49)
                        progress = round(50 + processing_progress, 2)
                        progress = min(progress, 99)  # Cap at 99% until complete
                        
                        progress_msg = f"data: {json.dumps({'status': 'processing', 'progress': progress, 'processed': processed, 'message': f'Processed {processed} products...'})}\n\n"
                        yield progress_msg
                        await asyncio.sleep(0.001)  # Allow progress to be sent
                        
                except Exception as e:
                    errors.append(f"Row {processed + 1}: {str(e)}")
                    processed += 1  # Count errors as processed
            
            # Final commit for remaining rows
            db.commit()
            
            db.close()
            
            yield f"data: {json.dumps({'status': 'complete', 'progress': 100, 'processed': processed, 'total': processed, 'errors': len(errors), 'message': f'Import complete: {processed} products processed'})}\n\n"
            
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            error_trace = traceback.format_exc()
            print(f"Upload error: {error_msg}\n{error_trace}")  # Log to server console
            yield f"data: {json.dumps({'status': 'error', 'progress': 0, 'message': error_msg})}\n\n"
    
    # Return streaming response - this should start immediately once file upload completes
    response = StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked"
        }
    )
    print("Returning StreamingResponse")
    return response

@app.get("/api/products", response_model=ProductListResponse)
def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    sku: Optional[str] = None,
    name: Optional[str] = None,
    active: Optional[bool] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get products with filtering and pagination"""
    query = db.query(Product)
    
    if sku:
        query = query.filter(func.lower(Product.sku).like(f"%{sku.lower()}%"))
    if name:
        query = query.filter(func.lower(Product.name).like(f"%{name.lower()}%"))
    if active is not None:
        query = query.filter(Product.active == active)
    if description:
        query = query.filter(func.lower(Product.description).like(f"%{description.lower()}%"))
    
    # Order by ID descending to show newest products first
    query = query.order_by(desc(Product.id))
    
    total = query.count()
    products = query.offset(skip).limit(limit).all()
    
    return ProductListResponse(
        items=products,
        total=total,
        skip=skip,
        limit=limit
    )

@app.get("/api/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a single product by ID"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/api/products", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product"""
    # Check if SKU already exists (case-insensitive)
    existing = db.query(Product).filter(func.lower(Product.sku) == product.sku.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    
    new_product = Product(
        name=product.name,
        sku=product.sku.lower(),
        description=product.description,
        active=product.active
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@app.put("/api/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product: ProductUpdate, db: Session = Depends(get_db)):
    """Update a product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check SKU uniqueness if updating SKU
    if product.sku and product.sku.lower() != db_product.sku.lower():
        existing = db.query(Product).filter(func.lower(Product.sku) == product.sku.lower()).first()
        if existing:
            raise HTTPException(status_code=400, detail="Product with this SKU already exists")
        db_product.sku = product.sku.lower()
    
    if product.name is not None:
        db_product.name = product.name
    if product.description is not None:
        db_product.description = product.description
    if product.active is not None:
        db_product.active = product.active
    
    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(product)
    db.commit()
    return {"message": "Product deleted successfully"}

@app.delete("/api/products")
def delete_all_products(db: Session = Depends(get_db)):
    """Delete all products"""
    count = db.query(Product).delete()
    db.commit()
    return {"message": f"Deleted {count} products successfully"}

@app.post("/api/products/bulk-delete")
def delete_multiple_products(request: dict, db: Session = Depends(get_db)):
    """Delete multiple products by IDs"""
    product_ids = request.get('product_ids', [])
    
    if not product_ids:
        raise HTTPException(status_code=400, detail="No product IDs provided")
    
    count = db.query(Product).filter(Product.id.in_(product_ids)).delete(synchronize_session=False)
    db.commit()
    
    return {"message": f"Deleted {count} product(s) successfully", "deleted_count": count}

