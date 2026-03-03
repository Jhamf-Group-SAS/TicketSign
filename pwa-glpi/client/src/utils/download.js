export const downloadBlob = async (blob, filename) => {
    return new Promise((resolve, reject) => {
        try {
            // Utilizamos FileReader para convertir el Blob a Data URI (base64)
            // Esto salta el bug nativo de Android WebView / PWA standalone
            // que ignora el nombre original en ObjectURLs (blob:http...) y guarda el UUID.
            const reader = new FileReader();
            reader.onloadend = () => {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = reader.result;
                a.download = filename;

                // Anclamos y simulamos click real
                document.body.appendChild(a);
                a.click();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    resolve();
                }, 1000);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('Error in downloadBlob', error);
            reject(error);
        }
    });
};
