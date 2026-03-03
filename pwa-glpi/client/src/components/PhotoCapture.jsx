import { useState } from 'react';
import { Camera, X, ImageIcon } from 'lucide-react';
import { cn } from '../utils/cn';

const PhotoCapture = ({ onPhotosUpdate }) => {
    const [photos, setPhotos] = useState([]);

    const handleCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
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

                    const newPhotos = [...photos, dataUrl];
                    setPhotos(newPhotos);
                    onPhotosUpdate(newPhotos);
                };
            };
        }
    };

    const removePhoto = (index) => {
        const newPhotos = photos.filter((_, i) => i !== index);
        setPhotos(newPhotos);
        onPhotosUpdate(newPhotos);
    };

    return (
        <div className="flex flex-col w-full">
            <label className="text-[12px] font-[600] text-text-muted block mb-3 uppercase tracking-wide">
                Evidencias Fotográficas
            </label>

            <div className="grid grid-cols-4 gap-3 w-full">
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

                {photos.length < 4 && (
                    <label className="flex flex-col items-center justify-center aspect-square rounded-[12px] border-2 border-dashed border-color bg-tertiary cursor-pointer hover:border-primary-500 hover:bg-primary-500/10 transition-all group">
                        <Camera className="text-text-muted group-hover:text-primary-500 transition-colors" size={22} />
                        <span className="text-[10px] text-text-muted font-[700] tracking-widest uppercase group-hover:text-primary-500 transition-colors">Capturar</span>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleCapture}
                        />
                    </label>
                )}
            </div>
        </div>
    );
};

export default PhotoCapture;
