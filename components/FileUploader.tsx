import React, { useCallback, useState } from 'react';
import { DocumentArrowUpIcon, CheckCircleIcon } from './icons';

interface FileUploaderProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  label: string;
  id: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ file, onFileSelect, label, id }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <label
        htmlFor={id}
        onDrop={handleDrop}
        onDragOver={handleDragEnter}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer transition-colors
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
          ${file ? 'border-green-500 bg-green-50' : 'hover:border-gray-400'}`}
      >
        <div className="space-y-1 text-center">
          {file ? (
            <>
              <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
              <p className="font-semibold text-green-700">Archivo seleccionado</p>
              <p className="text-xs text-gray-500 break-all">{file.name}</p>
            </>
          ) : (
            <>
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <span className="relative rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <span>Carga un archivo</span>
                  <input id={id} name={id} type="file" accept=".pdf" className="sr-only" onChange={handleFileChange} />
                </span>
                <p className="pl-1">o arrástralo</p>
              </div>
              <p className="text-xs text-gray-500">Máximo PDF 50Mb</p>
            </>
          )}
        </div>
      </label>
    </div>
  );
};
