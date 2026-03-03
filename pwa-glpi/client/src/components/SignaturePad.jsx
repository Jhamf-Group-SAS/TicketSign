import { useState, useRef, useEffect } from 'react';

const SignaturePad = ({ onSave, label, theme }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    }, [theme]);

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const ctx = canvas.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        onSave(canvasRef.current.toDataURL());
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onSave(null);
    };

    return (
        <div className="flex flex-col">
            <label className="text-[12px] font-[600] text-text-muted block ml-1 mb-1.5 uppercase tracking-wide">{label}</label>
            <div className="relative border-2 border-dashed border-color rounded-[12px] bg-tertiary overflow-hidden group hover:border-primary-500/40 transition-colors">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={300}
                    className="w-full h-48 touch-none cursor-crosshair opacity-90"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                <button
                    onClick={clear}
                    className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest bg-secondary border border-color text-red-500 px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-500/10 transition-all"
                >
                    Limpiar
                </button>
            </div>
        </div>
    );
};

export default SignaturePad;
