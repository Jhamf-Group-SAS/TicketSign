import { useState } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';

const PhotoCapture = ({ onPhotosUpdate }) => {
    const [photos, setPhotos] = useState([]);

    const handleCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Compresión de imagen antes de guardar
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Ancho máximo razonable para reportes
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

                    // Comprimir a JPEG calidad 0.6
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
        <div className="space-y-4">
            <label className="text-sm font-medium text-slate-400">Evidencias Fotográficas</label>

            <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700">
                        <img src={photo} alt={`Evidence ${index}`} className="w-full h-full object-cover" />
                        <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 bg-red-600 rounded-full p-1"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}

                {photos.length < 5 && (
                    <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-700 bg-slate-800 cursor-pointer hover:bg-slate-750 transition-colors">
                        <Camera className="text-slate-500 mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">Capturar</span>
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
