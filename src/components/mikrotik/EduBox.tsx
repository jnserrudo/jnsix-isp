import React, { useState } from 'react';
import { HelpCircle, Terminal, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface EduBoxProps {
  title: string;
  winboxPath: string;
  command: string;
  concept: string;
  parameters: Array<{ name: string; desc: string; type: string }>;
}

const EduBox: React.FC<EduBoxProps> = ({ title, winboxPath, command, concept, parameters }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div 
      className="info-banner" 
      style={{ 
        borderLeft: '3px solid var(--accent)', 
        padding: '1.25rem 1.5rem', 
        marginBottom: '1.5rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderLeftColor: 'var(--accent)'
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          cursor: 'pointer' 
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HelpCircle size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ffffff', margin: 0 }}>
            Guía Didáctica de RouterOS: {title}
          </h3>
        </div>
        <button 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          {/* Concept section */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
              Concepto Técnico
            </span>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
              {concept}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
            {/* Winbox path */}
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                <Layers size={12} /> Ruta en Winbox
              </span>
              <code style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {winboxPath}
              </code>
            </div>

            {/* CLI Command */}
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                <Terminal size={12} /> Comando de API RouterOS
              </span>
              <code style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {command}
              </code>
            </div>
          </div>

          {/* Key Parameters */}
          {parameters && parameters.length > 0 && (
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
                Parámetros Clave de la API
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {parameters.map((param, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'baseline', 
                      fontSize: '0.8rem', 
                      borderBottom: '1px solid var(--bg-tertiary)', 
                      paddingBottom: '0.25rem' 
                    }}
                  >
                    <code style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'monospace', minWidth: '120px' }}>
                      {param.name}
                    </code>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '80px', textTransform: 'uppercase' }}>
                      ({param.type})
                    </span>
                    <span style={{ color: 'var(--text-main)', marginLeft: '1rem' }}>
                      {param.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EduBox;
