import React from 'react';

interface SkeletonTableProps {
  /** Number of fake rows to show */
  rows?: number;
  /** Column widths as percentages or fixed values, e.g. ['30%', '15%', '20%', '15%', '10%', '10%'] */
  columns?: string[];
}

/**
 * Reusable skeleton table loader.
 * Renders animated shimmer rows that mimic the shape of the real table,
 * avoiding the "frozen" feeling of plain "Cargando..." text.
 */
const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 7,
  columns = ['30%', '15%', '18%', '15%', '12%', '10%'],
}) => {
  return (
    <div
      className="table-wrapper"
      style={{ overflow: 'hidden' }}
      aria-busy="true"
      aria-label="Cargando datos..."
    >
      {/* Fake thead */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns.map(() => '1fr').join(' '),
          padding: '0.75rem 1.25rem',
          borderBottom: '2px solid var(--border-color)',
          gap: '1rem',
        }}
      >
        {columns.map((_, i) => (
          <span
            key={i}
            className="skeleton-block skeleton-cell"
            style={{ width: '60%', opacity: 0.5 }}
          />
        ))}
      </div>

      {/* Fake rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="skeleton-row"
          style={{
            gridTemplateColumns: columns.map(() => '1fr').join(' '),
            // Slightly stagger opacity for a more natural look
            opacity: 1 - rowIdx * 0.08,
          }}
        >
          {columns.map((_, colIdx) => (
            <span
              key={colIdx}
              className="skeleton-block skeleton-cell"
              style={{
                // First column (name) is wider
                width: colIdx === 0 ? '80%' : `${50 + Math.floor(Math.random() * 35)}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default SkeletonTable;
