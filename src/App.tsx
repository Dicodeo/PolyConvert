/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle2, 
  RefreshCw, 
  Download, 
  AlertCircle,
  FileArchive,
  ImageIcon,
  ArrowRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileItem, 
  FileStatus, 
  convertFile, 
  getTargetFormats 
} from './lib/converters';
import { cn } from './lib/utils';

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [dirHandle, setDirHandle] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Erro ao selecionar pasta:', err);
      }
    }
  };

  const saveToDirectory = async (handle: any, blob: Blob, fileName: string) => {
    try {
      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.error('Erro ao salvar no sistema de arquivos:', err);
      return false;
    }
  };

  const addFiles = useCallback((incomingFiles: FileList | File[]) => {
    const newItems: FileItem[] = Array.from(incomingFiles).map(file => {
      const formats = getTargetFormats(file.type);
      return {
        id: Math.random().toString(36).substring(7),
        file,
        targetFormat: formats[0] || 'zip',
        status: 'pending',
        progress: 0
      };
    });
    setFiles(prev => [...prev, ...newItems]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFormat = (id: string, format: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, targetFormat: format, status: 'pending' } : f));
  };

  const startConversion = async (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'converting', progress: 50 } : f));
    
    const item = files.find(f => f.id === id);
    if (!item) return;

    try {
      const result = await convertFile(item);
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'completed', 
        progress: 100,
        resultBlob: result.blob,
        resultName: result.name
      } : f));

      // Auto-save if directory is selected
      if (dirHandle && result.blob && result.name) {
        await saveToDirectory(dirHandle, result.blob, result.name);
      }
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: String(err)
      } : f));
    }
  };

  const startAll = async () => {
    const pending = files.filter(f => f.status === 'pending');
    for (const f of pending) {
      await startConversion(f.id);
    }
  };

  const downloadFile = async (item: FileItem) => {
    if (!item.resultBlob || !item.resultName) return;

    if (dirHandle) {
      const success = await saveToDirectory(dirHandle, item.resultBlob, item.resultName);
      if (success) return; // File saved to folder
    }

    const url = URL.createObjectURL(item.resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.resultName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-dark-bg text-[#E0E0E0] font-sans selection:bg-gold/20">
      {/* Navigation */}
      <nav className="border-b border-border bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gold rounded-sm rotate-45 flex items-center justify-center">
              <div className="w-4 h-4 bg-dark-bg rounded-sm" />
            </div>
            <span className="font-serif text-xl tracking-[0.2em] text-gold uppercase">PolyConvert</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-medium text-white/60">
            <a href="#" className="hover:text-gold transition-colors">Formatos</a>
            <a href="#" className="hover:text-gold transition-colors">Lote</a>
            <a href="#" className="hover:text-gold transition-colors">Enterprise</a>
            <a href="#" className="hover:text-gold transition-colors font-bold text-gold">Grátis</a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto grid grid-cols-12 min-h-[calc(100vh-80px)] border-x border-border">
        {/* Left Pane: Dropzone */}
        <div className="col-span-12 lg:col-span-5 bg-pane-bg p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-border flex flex-col items-center justify-center">
          <div className="max-w-sm w-full text-center mb-10">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-serif italic text-white mb-4"
            >
              Arquivar & Converter
            </motion.h1>
            <p className="text-white/40 text-sm leading-relaxed tracking-wide">
              Seguro, rápido e gratuito. Processe múltiplos arquivos diretamente no seu hardware local.
            </p>
          </div>

          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full aspect-square border border-dashed rounded-lg flex flex-col items-center justify-center bg-[#111111] transition-all duration-500 ease-out cursor-pointer group",
              isDragActive ? "border-gold bg-gold/5 scale-[1.02]" : "border-[#2D2D2D]"
            )}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files && addFiles(e.target.files)} 
              multiple 
              className="hidden" 
            />
            <div className="mb-6">
              <Upload className={cn(
                "w-12 h-12 transition-colors duration-500",
                isDragActive ? "text-gold" : "text-[#2D2D2D] group-hover:text-gold"
              )} />
            </div>
            <h2 className="text-xl font-serif text-white mb-2 italic">Importar Arquivos</h2>
            <p className="text-[10px] uppercase tracking-widest text-white/30 px-12 text-center">
              JAR, PNG, JPG, WEBP • Max 50MB
            </p>
            <button className="mt-8 px-8 py-3 bg-[#1A1A1A] border border-[#2D2D2D] text-[10px] tracking-[0.25em] uppercase hover:bg-gold hover:text-dark-bg transition-all font-bold">
              Selecionar
            </button>
          </motion.div>

          <div className="mt-8 flex gap-4 text-[10px] tracking-widest uppercase text-white/20">
            <span>Privacidade Total</span>
            <span>•</span>
            <span>Sem Servidor</span>
          </div>
        </div>

        {/* Right Pane: Queue */}
        <div className="col-span-12 lg:col-span-7 flex flex-col bg-dark-bg min-h-[500px]">
          <div className="px-8 py-8 border-b border-border flex justify-between items-end">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gold mb-2">Fila de Conversão</h3>
              <p className="text-2xl font-serif italic text-white leading-none">
                {files.length} {files.length === 1 ? 'Arquivo Selecionado' : 'Arquivos Selecionados'}
              </p>
            </div>
            {files.length > 0 && (
              <div className="text-right">
                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                  Total: {formatSize(files.reduce((acc, f) => acc + f.file.size, 0))}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 px-8 py-3 text-[10px] uppercase tracking-widest text-white/30 border-b border-border bg-pane-bg">
              <div className="col-span-6">Arquivo</div>
              <div className="col-span-3">Formato</div>
              <div className="col-span-3 text-right">Status</div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence initial={false}>
                {files.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "grid grid-cols-12 px-8 py-5 border-b border-border items-center transition-colors hover:bg-item-bg/50",
                      idx % 2 === 0 ? "bg-item-bg" : "bg-dark-bg"
                    )}
                  >
                    <div className="col-span-6 flex flex-col min-w-0 pr-4">
                      <span className="text-sm text-white font-medium mb-1 truncate">{item.file.name}</span>
                      <span className="text-[10px] text-white/20 font-mono tracking-wider">{formatSize(item.file.size)}</span>
                    </div>

                    <div className="col-span-3">
                      {item.status === 'pending' ? (
                        <select 
                          value={item.targetFormat}
                          onChange={(e) => updateFormat(item.id, e.target.value)}
                          className="bg-[#1A1A1A] border border-[#2D2D2D] px-2 py-1 text-[10px] w-fit rounded uppercase tracking-tighter text-white/60 outline-none hover:border-gold transition-colors cursor-pointer"
                        >
                          {getTargetFormats(item.file.type).map(f => (
                            <option key={f} value={f}>.{f}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="bg-[#1A1A1A] border border-[#2D2D2D] px-2 py-1 text-[10px] w-fit rounded uppercase tracking-tighter text-white/40">
                          .{item.targetFormat}
                        </div>
                      )}
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-3">
                      {item.status === 'pending' && (
                        <button 
                          onClick={() => startConversion(item.id)}
                          className="text-[11px] text-gold italic hover:text-white transition-colors flex items-center gap-2"
                        >
                          Processar
                        </button>
                      )}
                      {item.status === 'converting' && (
                        <div className="text-right w-full">
                          <div className="h-1 bg-border w-full rounded-full overflow-hidden mb-1">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              className="h-full bg-gold" 
                            />
                          </div>
                          <span className="text-[10px] text-white/40 uppercase tracking-widest">{item.progress}%</span>
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <button 
                          onClick={() => downloadFile(item)}
                          className="text-[11px] text-green-500 italic hover:text-green-400 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Baixar
                        </button>
                      )}
                      {item.status === 'error' && (
                        <span className="text-[11px] text-red-500 italic">Falha</span>
                      )}
                      
                      <button 
                        onClick={() => handleRemove(item.id)}
                        className="text-white/10 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {files.length === 0 && (
                <div className="flex-1 flex items-center justify-center opacity-10 bg-[radial-gradient(#2D2D2D_1px,transparent_1px)] bg-[size:20px_20px] min-h-[300px]">
                  <span className="text-[10px] uppercase tracking-[0.4em]">Fila de Processamento Inativa</span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="p-8 border-t border-border flex items-center justify-between bg-pane-bg mt-auto">
              {files.length > 0 ? (
                <>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setFiles([])}
                      className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors text-left"
                    >
                      Limpar Fila
                    </button>
                    <button 
                      onClick={selectFolder}
                      className={cn(
                        "text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2",
                        dirHandle ? "text-gold" : "text-white/40 hover:text-white"
                      )}
                    >
                      {dirHandle ? `Pasta: ${dirHandle.name}` : 'Selecionar Pasta de Destino'}
                    </button>
                  </div>
                  <div className="flex gap-4">
                    {files.some(f => f.status === 'completed') && (
                      <button className="px-8 py-4 bg-[#1A1A1A] border border-[#2D2D2D] text-[10px] tracking-[0.2em] uppercase hover:bg-[#2D2D2D] transition-all font-bold text-white/60">
                        Baixar Tudo
                      </button>
                    )}
                    {files.some(f => f.status === 'pending') && (
                      <button 
                        onClick={startAll}
                        className="px-8 py-4 bg-gold text-dark-bg text-[10px] tracking-[0.2em] uppercase hover:bg-gold-cream transition-all font-black shadow-[0_0_30px_rgba(197,162,103,0.1)]"
                      >
                        {dirHandle ? 'Processar e Salvar' : 'Processar Todos'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full text-center flex flex-col gap-4">
                  <span className="text-[9px] uppercase tracking-[0.3em] opacity-20">Aguardando Importação...</span>
                  <button 
                    onClick={selectFolder}
                    className={cn(
                      "text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2 mx-auto",
                      dirHandle ? "text-gold" : "text-white/20 hover:text-white/40"
                    )}
                  >
                    {dirHandle ? `Destino: ${dirHandle.name}` : 'Configurar Pasta de Destino'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-10 py-6 flex flex-col md:flex-row justify-between items-center border-t border-border bg-dark-bg text-white/30">
        <div className="flex gap-8 text-[9px] uppercase tracking-widest mb-4 md:mb-0">
          <span>Versão: 2.0.4</span>
          <span>Arquitetura: Browser-Only</span>
          <span>Criptografia: SHA-256</span>
        </div>
        <div className="text-[11px] font-serif italic tracking-wide">
          Crafted for Precision & Privacy.
        </div>
      </footer>
    </div>
  );
}

