import { useState, useEffect } from 'react';
import { Camera, X, ImageIcon } from 'lucide-react';
import { cn } from '../utils/cn';

const PhotoCapture = ({ onPhotosUpdate, initialPhotos = [] }) => {
    const [photos, setPhotos] = useState(initialPhotos);

    useEffect(() => {
        if (initialPhotos && initialPhotos.length > 0) {
            setPhotos(initialPhotos);
        }
    }, [initialPhotos]);

    const handleFiles = (fileList) => {
        if (!fileList || fileList.length === 0) return;

        const remainingSlots = 4 - photos.length;
        const filesToProcess = Array.from(fileList).slice(0, remainingSlots);

        if (filesToProcess.length === 0) return;

        let processedPhotos = [];
        let loadedCount = 0;

        filesToProcess.forEach((file) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

                    processedPhotos.push(dataUrl);
                    loadedCount++;

                    if (loadedCount === filesToProcess.length) {
                        const newPhotos = [...photos, ...processedPhotos].slice(0, 4);
                        setPhotos(newPhotos);
                        onPhotosUpdate(newPhotos);
                    }
                };
                img.onerror = () => {
                    loadedCount++;
                    if (loadedCount === filesToProcess.length) {
                        const newPhotos = [...photos, ...processedPhotos].slice(0, 4);
                        setPhotos(newPhotos);
                        onPhotosUpdate(newPhotos);
                    }
                };
            };
            reader.onerror = () => {
                loadedCount++;
                if (loadedCount === filesToProcess.length) {
                    const newPhotos = [...photos, ...processedPhotos].slice(0, 4);
                    setPhotos(newPhotos);
                    onPhotosUpdate(newPhotos);
                }
            };
        });
    };

    const removePhoto = (index) => {
        const newPhotos = photos.filter((_, i) => i !== index);
        setPhotos(newPhotos);
        onPhotosUpdate(newPhotos);
    };

    return (
        <div className="flex flex-col w-full">
            <label className="text-[12px] font-[600] text-text-muted block mb-3 uppercase tracking-wide">
                Evidencias Fotográficas (Máx. 4 fotos)
            </label>

            {/* Thumbnail grid */}
            {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-3 w-full mb-4">
                    {photos.map((photo, index) => (
                        <div key={index} className="relative aspect-square rounded-[12px] overflow-hidden border border-color shadow-sm group">
                            <img src={photo} alt={`Evidence ${index}`} className="w-full h-full object-cover" />
                            <button
                                onClick={() => removePhoto(index)}
                                className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-md"
                            >
                                <X size={12} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload action buttons */}
            {photos.length < 4 ? (
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    {/* Camera Capture Button */}
                    <label className="flex-1 flex items-center justify-center gap-2 h-[48px] rounded-[12px] border-2 border-dashed border-color bg-tertiary cursor-pointer hover:border-primary-500 hover:bg-primary-500/10 transition-all group px-4">
                        <Camera className="text-text-muted group-hover:text-primary-500 transition-colors" size={20} />
                        <span className="text-[11px] text-text-muted font-[700] tracking-wider uppercase group-hover:text-primary-500 transition-colors">
                            Tomar Foto
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </label>

                    {/* Device File Selection Button */}
                    <label className="flex-1 flex items-center justify-center gap-2 h-[48px] rounded-[12px] border-2 border-dashed border-color bg-tertiary cursor-pointer hover:border-primary-500 hover:bg-primary-500/10 transition-all group px-4">
                        <ImageIcon className="text-text-muted group-hover:text-primary-500 transition-colors" size={20} />
                        <span className="text-[11px] text-text-muted font-[700] tracking-wider uppercase group-hover:text-primary-500 transition-colors">
                            Seleccionar del Dispositivo
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </label>
                </div>
            ) : (
                <div className="text-center py-2 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold rounded-lg uppercase tracking-wider">
                    Límite máximo de fotos alcanzado (4/4)
                </div>
            )}
        </div>
    );
};

export default PhotoCapture;
