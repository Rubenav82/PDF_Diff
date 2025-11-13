import React from 'react';
import type { PageMapping } from '../types';
import { ArrowRightIcon } from './icons';

interface PageMapperProps {
  pageCounts: { original: number; modified: number };
  mapping: PageMapping;
  onMappingChange: (mapping: PageMapping) => void;
}

export const PageMapper: React.FC<PageMapperProps> = ({ pageCounts, mapping, onMappingChange }) => {

  const handleMapChange = (originalPage: number, newModifiedPageStr: string) => {
    const newModifiedPage = parseInt(newModifiedPageStr, 10);
    // Permitir campo vacío, pero tratarlo como 0. Validar si no es un número.
    const valueToSet = isNaN(newModifiedPage) ? 0 : newModifiedPage;

    const newMapping = mapping.map(entry => 
      entry.originalPage === originalPage 
        ? { ...entry, modifiedPage: valueToSet } 
        : entry
    );
    onMappingChange(newMapping);
  };

  const getUnmappedModifiedPages = () => {
    const mappedModifiedPages = new Set(mapping.map(m => m.modifiedPage).filter(p => p > 0));
    const allModifiedPages = Array.from({ length: pageCounts.modified }, (_, i) => i + 1);
    return allModifiedPages.filter(p => !mappedModifiedPages.has(p));
  };
  
  const unmappedPages = getUnmappedModifiedPages();

  return (
    <div className="my-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Configurar Mapeo de Páginas</h3>
      <p className="text-sm text-gray-600 mb-6">
        Ajusta qué página del documento modificado se debe comparar con cada página del original. Ingresa '0' si una página fue eliminada.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
        {mapping.map(({ originalPage, modifiedPage }) => (
          <div key={originalPage} className="flex items-center space-x-3">
            <label htmlFor={`map-orig-${originalPage}`} className="w-28 text-sm font-medium text-gray-700 shrink-0">
              Original Pág. {originalPage}
            </label>
            <ArrowRightIcon className="h-5 w-5 text-gray-400" />
            <input
              id={`map-orig-${originalPage}`}
              type="number"
              min="0"
              max={pageCounts.modified}
              value={modifiedPage === 0 ? '' : modifiedPage}
              onChange={(e) => handleMapChange(originalPage, e.target.value)}
              className="w-24 block shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              aria-label={`Página modificada para la página original ${originalPage}`}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      {unmappedPages.length > 0 && (
        <div className="mt-6 p-3 bg-blue-100 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
                <span className="font-semibold">Páginas nuevas (no mapeadas) en doc. modificado:</span> {unmappedPages.join(', ')}
            </p>
        </div>
      )}
    </div>
  );
};
