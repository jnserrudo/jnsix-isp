import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (start === 1) {
        end = maxVisiblePages;
      } else if (end === totalPages) {
        start = totalPages - maxVisiblePages + 1;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '0.85rem 1rem', 
        backgroundColor: 'var(--bg-secondary)', 
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: '0.75rem',
        borderRadius: '0px'
      }}
    >
      {/* Items range display */}
      <div>
        {totalItems > 0 ? (
          <span>
            Mostrando <strong style={{ color: '#ffffff' }}>{startItem}</strong> a{' '}
            <strong style={{ color: '#ffffff' }}>{endItem}</strong> de{' '}
            <strong style={{ color: '#ffffff' }}>{totalItems}</strong> registros
          </span>
        ) : (
          <span>No hay registros disponibles</span>
        )}
      </div>

      {/* Pagination controls & items per page select */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        {/* Page size selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Mostrar:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1); // Reset to first page
            }}
            style={{
              padding: '0.2rem 0.5rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: '0px',
              outline: 'none'
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Prev / Page numbers / Next buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            onClick={handlePrev}
            disabled={currentPage === 1}
            className="btn btn-secondary btn-sm"
            style={{ 
              padding: '0.25rem 0.4rem', 
              display: 'flex', 
              alignItems: 'center', 
              borderRadius: '0px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
            title="Página Anterior"
          >
            <ChevronLeft size={14} />
          </button>

          {getPageNumbers().map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              style={{
                padding: '0.2rem 0.5rem',
                minWidth: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: currentPage === pageNum ? 'var(--accent)' : 'var(--bg-primary)',
                border: currentPage === pageNum ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderRadius: '0px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== pageNum) e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                if (currentPage !== pageNum) e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="btn btn-secondary btn-sm"
            style={{ 
              padding: '0.25rem 0.4rem', 
              display: 'flex', 
              alignItems: 'center', 
              borderRadius: '0px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
            title="Página Siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TablePagination;
