import { useState } from 'react';
import FileUpload from './FileUpload';
import ProductList from './ProductList';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Acme Inc. - Product Management</h1>
      </header>
      
      <nav className="app-nav">
        <button
          className={activeTab === 'upload' ? 'nav-button active' : 'nav-button'}
          onClick={() => setActiveTab('upload')}
        >
          Upload CSV
        </button>
        <button
          className={activeTab === 'products' ? 'nav-button active' : 'nav-button'}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'upload' && <FileUpload />}
        {activeTab === 'products' && <ProductList />}
      </main>
    </div>
  );
}

export default App;
