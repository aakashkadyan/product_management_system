import { useState, useEffect } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, deleteAllProducts, deleteMultipleProducts } from './api';
import './ProductList.css';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [error, setError] = useState('');
  
  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    sku: '',
    name: '',
    active: '',
    description: ''
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    active: true
  });
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Bulk delete
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Single delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Multiple delete confirmation
  const [showMultipleDeleteConfirm, setShowMultipleDeleteConfirm] = useState(false);
  const [deletingMultiple, setDeletingMultiple] = useState(false);

  useEffect(() => {
    loadProducts();
    setSelectedProducts([]); // Clear selection when page changes
  }, [page, filters]);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        skip: page * limit,
        limit: limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      };
      if (params.active === '') delete params.active;
      else if (params.active === 'true') params.active = true;
      else if (params.active === 'false') params.active = false;

      const response = await getProducts(params);
      setProducts(response.items);
      setTotal(response.total);
    } catch (error) {
      setError('Failed to load products: ' + error.message);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
    setPage(0); // Reset to first page when filtering
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setFormData({ name: '', sku: '', description: '', active: true });
    setFormError('');
    setShowForm(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      active: product.active
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');
    
    if (!formData.name || !formData.sku) {
      setFormError('Name and SKU are required');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      setShowForm(false);
      loadProducts();
    } catch (error) {
      setFormError(error.message);
    }
  };

  const handleDelete = (id) => {
    setProductToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    
    setDeleting(true);
    try {
      await deleteProduct(productToDelete);
      setSuccessMessage('Product deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowDeleteConfirm(false);
      setProductToDelete(null);
      loadProducts();
    } catch (error) {
      setError('Failed to delete product: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await deleteAllProducts();
      setShowBulkDeleteConfirm(false);
      setSuccessMessage('All products deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadProducts();
    } catch (error) {
      setError('Failed to delete products: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedProducts(products.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedProducts.length === 0) return;
    setShowMultipleDeleteConfirm(true);
  };

  const confirmDeleteMultiple = async () => {
    if (selectedProducts.length === 0) return;
    
    setDeletingMultiple(true);
    try {
      await deleteMultipleProducts(selectedProducts);
      setSuccessMessage(`${selectedProducts.length} product(s) deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setSelectedProducts([]);
      setShowMultipleDeleteConfirm(false);
      loadProducts();
    } catch (error) {
      setError('Failed to delete selected products: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeletingMultiple(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="product-list-container">
      <div className="product-list-header">
        <h2>Product Management</h2>
        <div className="header-actions">
          <button onClick={handleCreate} className="create-button">
            Create Product
          </button>
          {selectedProducts.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="delete-selected-button"
            >
              Delete Selected ({selectedProducts.length})
            </button>
          )}
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="bulk-delete-button"
          >
            Delete All Products
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" onClick={() => setError('')}>
          {error} <span className="close-error">×</span>
        </div>
      )}

      {successMessage && (
        <div className="success-message" onClick={() => setSuccessMessage('')}>
          {successMessage} <span className="close-success">×</span>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>SKU:</label>
          <input
            type="text"
            value={filters.sku}
            onChange={(e) => handleFilterChange('sku', e.target.value)}
            placeholder="Filter by SKU"
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Name:</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Filter by name"
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Active:</label>
          <select
            value={filters.active}
            onChange={(e) => handleFilterChange('active', e.target.value)}
            className="filter-select"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Description:</label>
          <input
            type="text"
            value={filters.description}
            onChange={(e) => handleFilterChange('description', e.target.value)}
            placeholder="Filter by description"
            className="filter-input"
          />
        </div>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="loading">Loading...</div>
      ) : products.length === 0 ? (
        <div className="no-products-container">
          <p className="no-products-message">No products to show</p>
          <p className="no-products-hint">Upload a CSV file or create a product manually to get started</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="product-table">
              <thead>
                <tr>
                  <th className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === products.length && products.length > 0}
                      onChange={handleSelectAll}
                      className="checkbox-input"
                    />
                  </th>
                  <th>ID</th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className={selectedProducts.includes(product.id) ? 'selected-row' : ''}>
                    <td className="checkbox-column">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="checkbox-input"
                      />
                    </td>
                    <td>{product.id}</td>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td className="description-cell">
                      {product.description || '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleEdit(product)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="page-button"
            >
              Previous
            </button>
            <span className="page-info">
              Page {page + 1} of {totalPages || 1} (Total: {total})
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="page-button"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProduct ? 'Edit Product' : 'Create Product'}</h3>
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                disabled={!!editingProduct}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="form-actions">
              <button onClick={handleSave} className="save-button">
                Save
              </button>
              <button onClick={() => setShowForm(false)} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Product</h3>
            <p>Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="form-actions">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="confirm-delete-button"
              >
                {deleting ? 'Deleting...' : 'OK'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Delete Confirmation */}
      {showMultipleDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !deletingMultiple && setShowMultipleDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Selected Products</h3>
            <p>Are you sure you want to delete {selectedProducts.length} selected product(s)? This action cannot be undone.</p>
            <div className="form-actions">
              <button
                onClick={confirmDeleteMultiple}
                disabled={deletingMultiple}
                className="confirm-delete-button"
              >
                {deletingMultiple ? 'Deleting...' : 'OK'}
              </button>
              <button
                onClick={() => setShowMultipleDeleteConfirm(false)}
                disabled={deletingMultiple}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !bulkDeleting && setShowBulkDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete All Products</h3>
            <p>Are you sure you want to delete all products? This action cannot be undone.</p>
            <div className="form-actions">
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="confirm-delete-button"
              >
                {bulkDeleting ? 'Deleting...' : 'Yes, Delete All'}
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductList;

