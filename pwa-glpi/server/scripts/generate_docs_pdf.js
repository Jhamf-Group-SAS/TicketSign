
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const projectRoot = path.resolve(__dirname, '../../');
const docsDir = path.join(projectRoot, 'docs');
const serverDir = path.join(projectRoot, 'server');

// Files to process
const documents = [
    {
        input: 'Technical_Documentation.md',
        output: 'Technical_Documentation.pdf',
        title: 'Documentación Técnica'
    },
    {
        input: 'User_Manual.md',
        output: 'Manual_de_Usuario.pdf',
        title: 'Manual de Usuario'
    }
];

const cssStyles = `
    body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0 auto;
        padding: 20px;
        max-width: 800px;
    }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    h3 { color: #7f8c8d; margin-top: 20px; }
    code { background-color: #f8f9fa; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
    pre { background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #e9ecef; }
    blockquote { border-left: 4px solid #3498db; padding-left: 15px; color: #555; background-color: #f1f9fe; padding: 10px; border-radius: 4px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    ul, ol { margin-left: 20px; }
    li { margin-bottom: 5px; }
    .page-break { page-break-after: always; }
`;

async function generatePDFs() {
    console.log('Iniciando generación de PDFs...');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        for (const doc of documents) {
            const inputPath = path.join(docsDir, doc.input);
            const outputPath = path.join(docsDir, doc.output);

            if (!fs.existsSync(inputPath)) {
                console.error(`❌ Archivo no encontrado: ${inputPath}`);
                continue;
            }

            console.log(`📄 Procesando: ${doc.input}...`);
            const markdownContent = fs.readFileSync(inputPath, 'utf8');

            const page = await browser.newPage();

            // HTML Template with Marked.js for rendering
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${doc.title}</title>
                    <meta charset="UTF-8">
                    <style>${cssStyles}</style>
                    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                </head>
                <body>
                    <div id="content"></div>
                    <script>
                        document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(markdownContent)});
                    </script>
                </body>
                </html>
            `;

            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            await page.pdf({
                path: outputPath,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                },
                displayHeaderFooter: true,
                headerTemplate: `<div style="font-size: 10px; text-align: center; width: 100%; color: #bbb;">${doc.title}</div>`,
                footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%; color: #bbb;">Pág. <span class="pageNumber"></span> de <span class="totalPages"></span></div>'
            });

            console.log(`✅ PDF generado: ${outputPath}`);
            await page.close();
        }
    } catch (error) {
        console.error('Error generando PDFs:', error);
    } finally {
        await browser.close();
        console.log('🏁 Proceso finalizado.');
    }
}

generatePDFs();
