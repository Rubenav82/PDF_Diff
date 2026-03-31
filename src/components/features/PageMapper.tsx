import React from 'react';
import type { PageMapping } from '../../types/types';
import { ArrowRightIcon } from '../ui/icons';

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

  const getDuplicatedModifiedPages = () => {
    const counts = new Map<number, number>();
    mapping.forEach((entry) => {
      if (entry.modifiedPage > 0) {
        counts.set(entry.modifiedPage, (counts.get(entry.modifiedPage) ?? 0) + 1);
      }
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([page]) => page)
    );
  };

  const handleAutoMapOneToOne = () => {
    const autoMapping = mapping.map((entry) => {
      if (entry.originalPage <= pageCounts.modified) {
        return { ...entry, modifiedPage: entry.originalPage };
      }
      return { ...entry, modifiedPage: 0 };
    });
    onMappingChange(autoMapping);
  };

  const handleShiftMapping = (offset: number) => {
    const shiftedMapping = mapping.map((entry) => {
      const shiftedPage = entry.originalPage + offset;
      if (shiftedPage < 1 || shiftedPage > pageCounts.modified) {
        return { ...entry, modifiedPage: 0 };
      }
      return { ...entry, modifiedPage: shiftedPage };
    });
    onMappingChange(shiftedMapping);
  };

  const handleSetAllDeleted = () => {
    onMappingChange(mapping.map((entry) => ({ ...entry, modifiedPage: 0 })));
  };
  
  const unmappedPages = getUnmappedModifiedPages();
  const duplicatedPages = getDuplicatedModifiedPages();

  return (
    <div className="my-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Configurar Mapeo de Páginas</h3>
      <p className="text-sm text-gray-600 mb-6">
        Ajusta qué página del documento modificado se debe comparar con cada página del original. Ingresa '0' si una página fue eliminada.
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAutoMapOneToOne}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
        >
          Mapeo 1:1
        </button>
        <button
          type="button"
          onClick={() => handleShiftMapping(-1)}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Desplazar -1
        </button>
        <button
          type="button"
          onClick={() => handleShiftMapping(1)}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Desplazar +1
        </button>
        <button
          type="button"
          onClick={handleSetAllDeleted}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
        >
          Marcar todas como eliminadas
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
        {mapping.map(({ originalPage, modifiedPage }) => (
          <div key={originalPage} className="flex items-center space-x-3">
            <label htmlFor={`map-orig-${originalPage}`} className="w-28 text-sm font-medium text-gray-700 shrink-0">
              Original Pág. {originalPage}
            </label>
            <ArrowRightIcon className="h-5 w-5 text-gray-400" />
            <select
              id={`map-orig-${originalPage}`}
              value={modifiedPage}
              onChange={(e) => handleMapChange(originalPage, e.target.value)}
              className={`w-28 block shadow-sm sm:text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                duplicatedPages.has(modifiedPage) && modifiedPage > 0
                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                  : 'border-gray-300'
              }`}
              aria-label={`Página modificada para la página original ${originalPage}`}
            >
              <option value={0}>Eliminada (0)</option>
              {Array.from({ length: pageCounts.modified }, (_, i) => i + 1).map((page) => (
                <option key={page} value={page}>
                  Pág. {page}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {duplicatedPages.size > 0 && (
        <div className="mt-6 p-3 bg-amber-100 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Mapeos duplicados detectados:</span>{' '}
            {Array.from(duplicatedPages).join(', ')}
          </p>
        </div>
      )}
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
