import React, { useCallback, useState } from 'react';
import { DocumentArrowUpIcon, CheckCircleIcon } from './icons';

// Configuración del tamaño máximo (en MB)
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface FileUploaderProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  label: string;
  id: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ file, onFileSelect, label, id }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.size > MAX_SIZE_BYTES) {
      setErrorMessage(`El archivo supera el límite de ${MAX_SIZE_MB}MB.`);
      return;
    }
    setErrorMessage(null);
    onFileSelect(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
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
          ${errorMessage ? 'border-red-300 bg-red-50' : isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
          ${file && !errorMessage ? 'border-green-500 bg-green-50' : 'hover:border-gray-400'}`}
      >
        <div className="space-y-1 text-center">
          {file && !errorMessage ? (
            <>
              <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
              <p className="font-semibold text-green-700">Archivo seleccionado</p>
              <p className="text-xs text-gray-500 break-all">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <DocumentArrowUpIcon className={`mx-auto h-12 w-12 ${errorMessage ? 'text-red-400' : 'text-gray-400'}`} />
              <div className="flex text-sm text-gray-600 justify-center">
                <span className="relative rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <span>Carga un archivo</span>
                  <input id={id} name={id} type="file" accept=".pdf" className="sr-only" onChange={handleFileChange} />
                </span>
                <p className="pl-1">o arrástralo</p>
              </div>
              <p className="text-xs text-gray-500">Máximo PDF {MAX_SIZE_MB}Mb</p>
            </>
          )}
        </div>
      </label>
      {errorMessage && (
        <p className="mt-2 text-sm text-red-600 text-center">{errorMessage}</p>
      )}
    </div>
  );
};