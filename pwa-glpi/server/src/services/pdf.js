import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

export const generateMaintenancePDF = async (actData) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  });
  const page = await browser.newPage();

  const isPreventive = actData.type === 'PREVENTIVO';

  // Obtener la ruta del logo
  const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo.png');
  let logoBase64 = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Error cargando logo para PDF:', e.message);
  }

  const htmlContent = `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 20px; line-height: 1.1; font-size: 10px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 15px; }
          .logo-area { display: flex; align-items: center; gap: 8px; background: #0f172a; padding: 10px; border-radius: 8px; }
          .logo-img { height: 35px; }
          .document-info { text-align: right; padding: 10px 5px; }
          .ticket-badge { background: #eff6ff; color: #1e40af; padding: 6px 18px; border-radius: 99px; font-weight: 700; font-size: 13px; border: 1px solid #bfdbfe; display: inline-block; margin-bottom: 8px; }
          
          .section { margin-top: 15px; clear: both; }
          .section-title { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #3b82f6; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 10px; }
          
          .technical-grid { display: block; width: 100%; margin-bottom: 10px; }
          .grid-row { display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 0; }
          .field { flex: 1; min-width: 23%; display: flex; align-items: baseline; gap: 5px; }
          .label { font-size: 7px; font-weight: 700; color: #94a3b8; text-transform: uppercase; white-space: nowrap; }
          .val { font-size: 9px; font-weight: 600; color: #1e293b; }

          .user-row { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
          .user-info-label { font-size: 8px; font-weight: 700; color: #3b82f6; text-transform: uppercase; }
          .user-info-val { font-size: 12px; font-weight: 900; color: #0f172a; }

          .checklist-container { display: grid; grid-template-cols: repeat(4, 1fr); gap: 4px; padding: 5px; background: #fff; }
          .checklist-item { font-size: 8px; display: flex; align-items: center; gap: 4px; color: #475569; }
          .check-mark { color: #10b981; font-weight: bold; }

          .work-box { background: #f8fafc; padding: 6px; border-radius: 4px; font-size: 9px; color: #334155; border: 1px solid #e2e8f0; min-height: 25px; }

          .footer-signatures { 
            margin-top: 25px; 
            display: flex; 
            justify-content: space-between; 
            gap: 20px; 
            width: 100%;
          }
          .signature-box { 
            flex: 1; 
            text-align: center; 
            padding: 15px; 
            border: 1px solid #e2e8f0; 
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          .sig-img-container {
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
          }
          .signature-img { 
            max-height: 80px; 
            max-width: 200px;
            object-fit: contain;
            display: block;
            filter: brightness(0); /* Forzar trazo negro absoluto */
          }
          .signature-line {
            border-top: 1px solid #e2e8f0;
            margin-top: 5px;
            padding-top: 5px;
          }
          .sig-label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
          .sig-name { font-size: 9px; font-weight: 600; color: #1e293b; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" />` : '<span style="font-size:18px; font-weight:900;">GLPI<span style="color:#3b82f6;">PRO</span></span>'}
          </div>
          <div class="document-info">
            <span class="ticket-badge">Ticket #${actData.glpi_ticket_id || 'S/N'}</span>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px; font-weight: 700;">ACTA DE SERVICIO DIGITAL</div>
          </div>
        </div>

        <div class="user-row">
          <div>
            <div class="user-info-label">Usuario / Dueño del Equipo</div>
            <div class="user-info-val">${actData.assigned_user || actData.client_name || 'No especificado'}</div>
          </div>
          <div style="text-align: right">
            <div class="user-info-label">ID de Acta</div>
            <div style="font-size: 10px; font-weight: 700;">${actData.id ? (typeof actData.id === 'string' ? actData.id.substring(0, 8) : actData.id) : 'L-001'}</div>
          </div>
        </div>

        <div class="section" style="margin-top:0;">
          <div class="section-title">Detalles Técnicos y de Empresa</div>
          <div class="technical-grid">
            <div class="grid-row">
              <div class="field"><span class="label">EMPRESA:</span><span class="val">${actData.client_name}</span></div>
              <div class="field"><span class="label">NÚM. INVENTARIO:</span><span class="val" style="color:#2563eb; font-weight:900;">${actData.inventory_number || 'S/N'}</span></div>
              <div class="field"><span class="label">EQUIPO:</span><span class="val">${actData.equipment_hostname}</span></div>
              <div class="field"><span class="label">SERIAL:</span><span class="val" style="font-family: monospace;">${actData.equipment_serial}</span></div>
            </div>
            <div class="grid-row" style="border:none;">
              <div class="field"><span class="label">TÉCNICO:</span><span class="val">${actData.technical_name}</span></div>
              <div class="field"><span class="label">FECHA:</span><span class="val">${new Date(actData.createdAt).toLocaleDateString()}</span></div>
              <div class="field"><span class="label">SERVICIO:</span><span class="val">${actData.type}</span></div>
              <div class="field"><span class="label">MODELO:</span><span class="val">${actData.equipment_model}</span></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${isPreventive ? 'Actividades Ejecutadas' : 'Descripción del Servicio'}</div>
          ${isPreventive ? `
            <div class="checklist-container" style="display: block;">
              ${Object.entries(actData.checklist)
        .filter(([_, val]) => val === true)
        .map(([key]) => `
                <div class="checklist-item" style="margin-bottom: 4px; font-size: 10px;">
                  <span class="check-mark">✔</span>
                  <span>${key.replace(/_/g, ' ')}</span>
                </div>
              `).join('') || '<div style="font-size:9px; color:#94a3b8;">No se marcaron tareas.</div>'}
            </div>
          ` : `
            <div style="display:grid; grid-template-cols: 1fr 1fr; gap:10px;">
              <div class="field">
                <span class="label">Diagnóstico de Falla</span>
                <div class="work-box">${actData.checklist.diagnostico || actData.checklist.falla_reportada || 'N/A'}</div>
              </div>
              <div class="field">
                <span class="label">Trabajo Realizado</span>
                <div class="work-box">${actData.checklist.accion_realizada || 'N/A'}</div>
              </div>
            </div>
          `}
        </div>

        <div class="section">
          <span class="label">Observaciones</span>
          <div class="work-box" style="min-height: 40px; margin-top: 4px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">${actData.observations || 'Sin observaciones.'}</div>
        </div>

        <div class="section">
          <span class="label">Recomendaciones</span>
          <div class="work-box" style="min-height: 40px; margin-top: 4px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">${actData.recommendations || 'Sin recomendaciones.'}</div>
        </div>

        ${actData.photos && actData.photos.length > 0 ? `
          <div class="section">
            <div class="section-title">Evidencias Fotográficas</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px;">
              ${actData.photos.map(photo => `
                <div style="width: calc(33.33% - 6px); height: 110px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="footer-signatures">
          <div class="signature-box">
            <div class="sig-label">Firma del Técnico</div>
            <div class="sig-img-container">
              ${actData.signatures.technical ? `<img src="${actData.signatures.technical}" class="signature-img" />` : '<div style="color:#cbd5e1; font-style:italic">Pendiente</div>'}
            </div>
            <div class="signature-line">
              <div class="sig-name">${actData.technical_name}</div>
            </div>
          </div>
          
          <div class="signature-box">
            <div class="sig-label">Firma Cliente / Empresa</div>
            <div class="sig-img-container">
              ${actData.signatures.client ? `<img src="${actData.signatures.client}" class="signature-img" />` : '<div style="color:#cbd5e1; font-style:italic">Pendiente</div>'}
            </div>
            <div class="signature-line">
              <div class="sig-name">${actData.assigned_user || actData.client_name}</div>
            </div>
          </div>
        </div>

        <div style="margin-top:20px; font-size: 7px; color: #94a3b8; text-align: center; border-top: 1px dotted #e2e8f0; padding-top: 8px;">
          Documento digital verificado generado por el sistema GLPI PRO. 
          Página 1 de 1.
        </div>
      </body>
    </html>
  `;

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
  });

  await browser.close();
  return pdfBuffer;
};

export const generateConsolidatedPDF = async (clientName, acts) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  });
  const page = await browser.newPage();

  // Obtener la ruta del logo
  const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo.png');
  let logoBase64 = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Error cargando logo para PDF:', e.message);
  }

  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; padding: 40px; }
          .header { border-bottom: 3px solid #0056b3; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
          .logo-img { height: 50px; }
          .header-text { text-align: right; }
          .title { font-size: 24px; color: #0056b3; font-weight: bold; margin: 0; }
          .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #0056b3; color: white; padding: 10px; text-align: left; font-size: 12px; }
          td { border-bottom: 1px solid #ddd; padding: 10px; font-size: 11px; }
          .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: center; gap: 60px; }
          .stat { display: flex; flex-direction: column; text-align: center; }
          .stat-val { font-size: 24px; font-weight: bold; color: #0056b3; }
          .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" />` : '<span style="font-size:24px; font-weight:bold;">GLPI<span style="color:#0056b3;">PRO</span></span>'}
          </div>
          <div class="header-text">
            <h1 class="title">REPORTE CONSOLIDADO</h1>
            <div class="subtitle">EMPRESA: <strong>${clientName}</strong> | ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="stat">
            <span class="stat-val">${acts.length}</span>
            <span class="stat-label">Total Equipos</span>
          </div>
          <div class="stat">
            <span class="stat-val">${acts.filter(a => a.type === 'PREVENTIVO').length}</span>
            <span class="stat-label">Preventivos</span>
          </div>
          <div class="stat">
            <span class="stat-val">${acts.filter(a => a.type === 'CORRECTIVO').length}</span>
            <span class="stat-label">Correctivos</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hostname / Modelo</th>
              <th>Serial Number</th>
              <th>Usuario</th>
              <th>Tipo</th>
              <th>Status Final</th>
              <th>Ticket GLPI</th>
            </tr>
          </thead>
          <tbody>
            ${acts.map(act => `
              <tr>
                <td>${new Date(act.createdAt).toLocaleDateString()}</td>
                <td>
                    <strong>${act.equipment_hostname || 'S/H'}</strong><br/>
                    <small style="color:#666">${act.equipment_model || '-'}</small>
                </td>
                <td style="font-family: monospace;">${act.equipment_serial}</td>
                <td><strong>${act.assigned_user}</strong></td>
                <td>
                    <span style="color: ${act.type === 'PREVENTIVO' ? '#0056b3' : '#d9480f'}">${act.type}</span>
                </td>
                <td>${act.type === 'PREVENTIVO' ? 'COMPLETADO' : (act.checklist.estado_final || 'REPARADO')}</td>
                <td>#${act.glpi_ticket_id}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Este es un reporte automático generado por GLPI PRO v1.0. 
          Certificamos que todos los mantenimientos listados cuentan con firmas de conformidad digitales.
        </div>
      </body>
    </html>
  `;

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

  await browser.close();
  return pdfBuffer;
};
