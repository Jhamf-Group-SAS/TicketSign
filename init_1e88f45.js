
>     async 
initSession() {
          const { 
apiUrl, appToken, 
userToken } = 
this.config;
          
console.log(`[GLPI] 
Iniciando sesi├│n 
en: ${apiUrl}`);
  
          if 
(!apiUrl) throw new 
Error('GLPI_API_URL 
no configurado');
  
          try {
              
console.log(`[GLPI] 
Intentando conectar 
con App-Token: 
${appToken ? 'OK' : 
'MISSING'} y 
User-Token: 
${userToken ? 'OK' : 
'MISSING'}`);
  
>             const 
response = await axio
s.get(`${apiUrl}/init
Session`, {
                  
params: {
                     
 get_full_session: 
true
                  },
                  
headers: {
                     
 'App-Token': 
appToken,
                     
 'Authorization': 
`user_token 
${userToken}`
                  }
              });
  
              
this.sessionToken = r
esponse.data.session_
token;
              const 
currentProfile = resp
onse.data.session?.gl
piprofiles?.name || 
'Desconocido';
              const 
activeProfileId = res
ponse.data.session.gl
piactiveprofile?.id;
              const 
activeProfileName = r
esponse.data.session.
glpiactiveprofile?.na
me;
  
              
console.log(`[GLPI] 
Sesi├│n establecida. 
ID Sesi├│n: ${this.se
ssionToken?.substring
(0, 10)}...`);
              
console.log(`[GLPI] 
Perfil Activo: 
${activeProfileName} 
(ID: ${activeProfileI
d})`);
  
              // 
Auto-switch profile 
logic
              let 
profiles = response.d
ata.session?.glpiprof
iles || [];
  
              // Si 
profiles no es un 
array (ej: un objeto 
si solo hay uno), 
convertirlo
              if (!Ar
ray.isArray(profiles)
) {
                  // 
Si es un objeto, lo 
ponemos en un array. 
Si es 
null/undefined, 
array vac├¡o.
                  
profiles = profiles 
? [profiles] : [];
              }
  
              const 
currentProfileName = 
(activeProfileName 
|| '').toLowerCase();
              const 
allowedProfiles = 
['especialistas', 
'super-admin', 
'admin'];
  
              // 
Verificar si el 
perfil actual ya es 
de alto privilegio
              const 
isAlreadyAllowed = al
lowedProfiles.some(p 
=> currentProfileName
.includes(p));
  
              if 
(isAlreadyAllowed) {
                  
console.log(`[GLPI] 
Perfil actual '${acti
veProfileName}' 
tiene privilegios 
suficientes. No se 
requiere cambio.`);
              } else 
{
                  // 
Intentar encontrar 
un perfil de alto 
privilegio en la 
lista
                  
const targetProfile 
= profiles.find(p =>
                     
 p.name && allowedPro
files.some(hp => p.na
me.toLowerCase().incl
udes(hp))
                  );
  
                  if 
(targetProfile && 
targetProfile.id !== 
activeProfileId) {
                     
 console.log(`[GLPI] 
Cambiando a perfil 
con mayores 
privilegios: ${target
Profile.name} (ID: ${
targetProfile.id})`);
                     
 await axios.post(`${
apiUrl}/changeActiveP
rofile`, {
                     
     profiles_id: 
targetProfile.id
                     
 }, {
                     
     headers: {
                     
         
'App-Token': 
appToken,
                     
         
'Session-Token': 
this.sessionToken
                     
     }
                     
 });
                     
 console.log('[GLPI] 
Perfil cambiado 
exitosamente.');
                  } 
else {
                     
 console.log(`[GLPI] 
No se encontr├│ un 
perfil mejor. 
Operando con: ${activ
eProfileName}`);
                  }
              }
  
              return 
this.sessionToken;
          } catch 
(error) {
>             console
.error('[GLPI] Error 
FATAL en 
initSession:', 
error.response?.data 
|| error.message);
              throw 
error;
          }
      }
  
      /**
       * Busca un 
activo (Computadora) 
por Numero de 
Inventario o Serial
       */
      async 
findComputer(query) {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              const 
response = await axio
s.get(`${apiUrl}/Comp
uter`, {
                  
params: {
                     
 searchText: query,
                     
 is_deleted: 0
                  },
                  
headers: {
                     
 'App-Token': 
appToken,
                     
 'Session-Token': 
this.sessionToken
                  }
              });
              return 
response.data[0] || 
null;
          } catch 
(error) {
              console
.error('[GLPI] Error 
en findComputer:', 
error.message);
              return 
null;
          }
      }
  
      /**
       * Sube un 
documento y lo 
asocia a un ├¡tem 
(Ticket o Project)
       */
      async uploadDoc
ument(itemId, 
filePath, fileName, 
itemtype = 'Ticket') 
{
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              // 0. 
Diagn├│stico previo 
(solo para Tickets)
              if 
(false && itemtype 
=== 'Ticket') {
                  
try {
                     
 const 
ticketResponse = 
await axios.get(`${ap
iUrl}/Ticket/${itemId
}`, {
                     
     headers: {
                     
         
'App-Token': 
appToken,
                     
         
'Session-Token': 
this.sessionToken
                     
     }
                     
 });
                     
 const ticket = 
ticketResponse.data;
                     
 console.log(`[GLPI] 
Diagn├│stico Ticket 
#${itemId}: Estado=${
ticket.status}, Entid
ad=${ticket.entities_
id}`);
  
                     
 // Verificar 
Entidad Activa
                     
 const 
sessionResponse = 
await axios.get(`${ap
iUrl}/getMyProfiles`,
 {
                     
     headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
                     
 });
                     
 // Nota: 
getMyProfiles no da 
la entidad activa, 
usamos session token 
info si fuera 
posible o asumimos 
la default.
                     
 // Mejor intentar 
cambiar entidad si 
difiere
  
                  } 
catch (ticketError) {
                     
 console.error(`[GLPI
] Error al consultar 
Ticket #${itemId}:`, 
ticketError.message);
                  }
              }
  
              
console.log(`[GLPI] 
Subiendo archivo a: 
${apiUrl}/Document`);
              const 
form = new 
FormData();
              form.ap
pend('uploadManifest'
, JSON.stringify({
                  
input: {
                     
 name: `Consolidado 
- ${fileName}`,
                     
 _filename: 
[fileName]
                  }
              }));
              form.ap
pend('filename', fs.c
reateReadStream(fileP
ath));
  
              // 1. 
Subir documento
              const 
response = await axio
s.post(`${apiUrl}/Doc
ument`, form, {
                  
headers: {
                     
 
...form.getHeaders(),
                     
 'App-Token': 
appToken,
                     
 'Session-Token': 
this.sessionToken
                  }
              });
  
              const 
docId = 
response.data.id;
              
console.log(`[GLPI] 
Documento creado 
(ID: ${docId}). 
Vinculando al 
${itemtype} 
#${itemId}...`);
  
              // 2. 
Asociar al ├ìtem
              await a
xios.post(`${apiUrl}/
Document_Item`, {
                  
input: {
                     
 documents_id: docId,
                     
 items_id: itemId,
                     
 itemtype: itemtype
                  }
              }, {
                  
headers: {
                     
 'App-Token': 
appToken,
                     
 'Session-Token': 
this.sessionToken
                  }
              });
  
              return 
{ id: docId, 
success: true };
          } catch 
(error) {
              console
.error(`[GLPI] ERROR 
DETALLADO en 
uploadDocument:`, {
                  
status: error.respons
e?.status,
                  
data: 
error.response?.data,
                  
itemtype,
                  
itemId,
                  
url: 
this.config.apiUrl
              });
              const 
errorMessage = JSON.s
tringify(error.respon
se?.data) || 
error.message;
              throw 
new Error(`GLPI 
Upload Error: 
${errorMessage}`);
          }
      }
  
      /**
       * Agrega un 
seguimiento al ├¡tem
       */
      async 
addFollowup(itemId, 
content, itemtype = 
'Ticket') {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          // GLPI 
usa ITILFollowup 
para Tickets, pero 
para Projects 
podr├¡a variar. 
          // Si es 
Project, solemos 
usar un comentario o 
el Document_Item es 
suficiente.
          // 
Mantenemos 
ITILFollowup solo 
para Tickets por 
ahora.
          if 
(itemtype !== 
'Ticket') return;
  
          try {
              await a
xios.post(`${apiUrl}/
ITILFollowup`, {
                  
input: {
                     
 items_id: itemId,
                     
 itemtype: itemtype,
                     
 content: content,
                     
 is_private: 0
                  }
              }, {
                  
headers: {
                     
 'App-Token': 
appToken,
                     
 'Session-Token': 
this.sessionToken
                  }
              });
              
console.log(`[GLPI] 
Seguimiento a├▒adido 
al ${itemtype} 
#${itemId}`);
          } catch 
(error) {
              console
.error(`[GLPI] Error 
en addFollowup para 
${itemtype}:`, 
error.response?.data 
|| error.message);
          }
      }
  
      /**
       * Obtiene 
t├®cnicos elegibles 
basados en sus 
perfiles
       */
      async getEligib
leTechnicians() {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              
console.log('[GLPI] 
Buscando t├®cnicos 
mediante 
Profile_User...');
              const 
targetProfiles = 
['Super-Admin', 
'Especialistas', 
'Admin-Mesa', 
'Administrativo'];
  
              // 1. 
Obtener todas las 
asociaciones de 
perfiles
              // 
Expandimos dropdowns 
para tener los 
nombres de perfiles 
y usuarios
              const 
response = await axio
s.get(`${apiUrl}/Prof
ile_User`, {
                  
params: {
                     
 range: '0-1000',
                     
 expand_dropdowns: 
true
                  },
                  
headers: {
                     
 'App-Token': 
appToken,
                     
 'Session-Token': 
this.sessionToken
                  }
              });
  
              if (!Ar
ray.isArray(response.
data)) {
                  // 
Si la respuesta no 
es un array directo, 
puede que est├® 
envuelta (v1 de la 
API antigua)
                  
const data = Array.is
Array(response.data) 
? response.data : 
(response.data.data 
|| []);
                  if 
(!Array.isArray(data)
) {
                     
 console.error('[GLPI
] Error: 
/Profile_User no 
devolvi├│ un array');
                     
 return [];
                  }
                  
response.data = data;
              }
  
              const 
eligibleUsersMap = 
new Map();
  
              for 
(const entry of 
response.data) {
                  // 
Con expand_dropdowns=
true, profiles_id 
suele traer el 
nombre del perfil
                  
const profileLabel = 
(entry.profiles_id 
|| '').toString();
  
                  // 
Intentar obtener el 
ID del usuario de 
forma robusta
                  
let userId = 
entry.users_id_id;
  
                  // 
Si no hay 
users_id_id, 
intentar extraer del 
link "User"
                  if 
(!userId && 
entry.links) {
                     
 const userLink = 
entry.links.find(l 
=> l.rel === 'User');
                     
 if (userLink) {
                     
     const parts = us
erLink.href.split('/'
);
                     
     const lastPart 
= parts[parts.length 
- 1];
                     
     if 
(!isNaN(lastPart)) 
userId = 
parseInt(lastPart);
                     
 }
                  }
  
                  // 
Fallback al "id" si 
es n├║mero (en 
algunas versiones 
este es el user id 
si viene filtrado)
                  if 
(!userId && 
!isNaN(entry.id)) {
                     
 userId = 
parseInt(entry.id);
                  }
  
                  if 
(!userId) continue;
  
                  // 
Validar contra 
perfiles objetivo 
(por nombre de 
perfil)
                  
const matches = targe
tProfiles.some(tp =>
                     
 profileLabel.toLower
Case().includes(tp.to
LowerCase()) ||
                     
 (entry.profiles_id_n
ame && entry.profiles
_id_name.toLowerCase(
).includes(tp.toLower
Case()))
                  );
  
                  if 
(matches) {
                     
 if (!eligibleUsersMa
p.has(userId)) {
                     
     eligibleUsersMap
.set(userId, {
                     
         id: userId,
                     
         name: 
(entry.users_id || 'U
suario').toString(),
                     
         fullName: 
(entry.users_id || 
'Usuario').toString()
                     
     });
                     
 }
                  }
              }
  
              const 
eligibleUsers = Array
.from(eligibleUsersMa
p.values());
              
console.log(`[GLPI] 
Identificados ${eligi
bleUsers.length} 
t├®cnicos por 
perfil. Obteniendo 
detalles adicionales 
(m├│vil)...`);
  
              // 
Obtener detalles 
(especialmente el 
m├│vil) para cada 
t├®cnico encontrado
              // Lo 
hacemos en batches 
para no saturar
              const 
BATCH_SIZE = 10;
              for 
(let i = 0; i < eligi
bleUsers.length; i 
+= BATCH_SIZE) {
                  
const batch = eligibl
eUsers.slice(i, i + 
BATCH_SIZE);
                  
await Promise.all(bat
ch.map(async (tech) 
=> {
                     
 try {
                     
     const userRes = 
await axios.get(`${ap
iUrl}/User/${tech.id}
`, {
                     
         headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
                     
     });
                     
     const userData 
= userRes.data;
  
                     
     // Construir 
nombre completo 
(Nombre Apellido)
                     
     const fname = 
userData.firstname 
|| '';
                     
     const lname = 
userData.realname || 
'';
                     
     tech.fullName = 
`${fname} 
${lname}`.trim() || 
userData.name;
                     
     tech.name = 
userData.name; // 
Username
                     
     tech.username = 
userData.name;
  
                     
     // GLPI suele 
guardar el m├│vil en 
mobile, phone, o 
phone2. Probamos 
mobile primero.
                     
     tech.mobile = 
userData.mobile || 
userData.phone || '';
                     
 } catch (err) {
                     
     
console.warn(`[GLPI] 
No se pudo obtener 
detalle para 
t├®cnico 
${tech.id}`);
                     
 }
                  
}));
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              
console.log(`[GLPI] 
Consultando 
tickets... 
Criteria:`, 
criteria);
  
              const 
params = {
                  
'range': 
criteria.range || 
'0-1000',
                  
'sort': 'id',
                  
'order': 'DESC',
                  
'is_deleted': 0,
                  
'status': 
(criteria.status === 
'pending' || 
!criteria.status) ? 
undefined : 
criteria.status,
                  
'expand_dropdowns': 
true
              };
  
              if 
(this.userCache.size 
< 10) {
                  
await 
this.getUsers();
              }
  
              const 
response = await axio
s.get(`${apiUrl}/Tick
et`, {
                  
params,
                  
headers: {
                     
 'App-Token': 
appToken,
                     
 'Session-Token': 
this.sessionToken
                  }
              });
  
              if (!Ar
ray.isArray(response.
data)) {
                  
console.warn('[GLPI] 
Respuesta no es un 
array:', 
response.data);
                  
return [];
              }
  
              const 
getTechName = (val) 
=> {
                  
const 
getNameFromCache = 
(item) => {
                     
 if (!item) return 
'';
                     
 const idOrLogin = 
(typeof item === 
'object') ? (item.id 
|| item.name) : item;
                     
 let cached = this.us
erCache.get(idOrLogin
) || this.userCache.g
et(String(idOrLogin))
 || this.userCache.ge
t(Number(idOrLogin));
                     
 if (!cached && 
typeof idOrLogin === 
'string') cached = th
is.loginCache.get(idO
rLogin.toLowerCase())
;
                     
 if (cached && 
cached.fullName) 
return 
cached.fullName;
                     
 if (typeof item === 
'object') return 
item.fullName || 
item.completename || 
item.realname || 
item.name || '';
                     
 return String(item);
                  };
                  if 
(Array.isArray(val) 
&& val.length > 0) 
return val.map(getNam
eFromCache).join(', 
');
                  
const name = getNameF
romCache(val);
                  
return (name === '0' 
|| name === 0) ? '' 
: name;
              };
  
              let 
tickets = 
response.data.map(t 
=> {
                  
const getId = (val) 
=> (val && typeof 
val === 'object' && 
val.id) ? val.id : 
val;
                  
const techId = getId(
Array.isArray(t.users
_id_technician) ? t.u
sers_id_technician[0]
 : t.users_id_technic
ian);
                  
const reqId = getId(A
rray.isArray(t.users_
id_recipient) ? t.use
rs_id_recipient[0] : 
t.users_id_recipient)
;
  
                  
return {
                     
 id: t.id,
                     
 title: t.name,
                     
 date: t.date,
                     
 date_mod: 
t.date_mod,
                     
 status: typeof 
t.status === 
'object' ? 
t.status.id : 
t.status,
                     
 status_desc: typeof 
t.status === 
'object' ? 
t.status.name : null,
                     
 priority: 
t.priority,
                     
 urgency: t.urgency,
                     
 description: 
t.content
                     
     ? t.content.repl
ace(/<[^>]*>?/gm, 
'').substring(0, 
150) + 
(t.content.length > 
150 ? '...' : '')
                     
     : 'Sin 
descripci├│n',
  
                     
 entity: 
t.entities_id,
                     
 category: 
t.itilcategories_id,
                     
 requester: 
t.users_id_recipient,
                     
 technician: t.users_
id_technician,
  
                     
 entity_name: typeof 
t.entities_id === 
'string' ? 
t.entities_id : 
(t.entities_id?.name 
|| 'N/A'),
                     
 category_name: 
typeof 
t.itilcategories_id 
=== 'string' ? 
t.itilcategories_id 
: (t.itilcategories_i
d?.name || ''),
                     
 requester_name: getT
echName(t.users_id_re
cipient) || 'N/A',
                     
 technician_name: get
TechName(t.users_id_t
echnician) || '',
                     
 technician_id_raw: 
techId,
                     
 requester_id_raw: 
reqId
                  };
              });
  
              
tickets.sort((a, b) 
=> b.id - a.id);
  
              try {
                  
const 
ticketsToEnrich = 
tickets.slice(0, 50);
                  
const BATCH_SIZE = 5;
  
                  
for (let i = 0; i < t
icketsToEnrich.length
; i += BATCH_SIZE) {
                     
 const batch = ticket
sToEnrich.slice(i, i 
+ BATCH_SIZE);
  
                     
 await Promise.all(ba
tch.map(async (t) => 
{
                     
     let actors = [];
                     
     let groupActors 
= [];
  
                     
     try {
                     
         const aRes 
= await axios.get(`${
apiUrl}/Ticket/${t.id
}/Ticket_User`, { 
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken } 
});
                     
         actors = Arr
ay.isArray(aRes.data)
 ? aRes.data : 
(aRes.data ? 
[aRes.data] : []);
                     
     } catch (e) {
                     
         try {
                     
             const 
aResAlt = await axios
.get(`${apiUrl}/Ticke
t_User`, {
                     
                 
params: { 
searchText: { 
tickets_id: t.id } },
                     
                 
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
                     
             });
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              
console.log(`[GLPI] 
Obteniendo detalle 
Ticket #${id}`);
  
              // 
Asegurar que tenemos 
la lista base de 
usuarios para 
resolver logins a 
nombres reales
              if 
(this.userCache.size 
< 10) {
                  
await 
this.getUsers();
              }
  
              const 
headers = { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken };
  
              // 1. 
Ticket Base
              const 
ticketRes = await axi
os.get(`${apiUrl}/Tic
ket/${id}`, {
                  
params: { 
expand_dropdowns: 
true },
                  
headers
              });
  
              // 2. 
Seguimientos 
(Followups)
              let 
followups = [];
              try {
                  
const fRes = await ax
ios.get(`${apiUrl}/Ti
cket/${id}/ITILFollow
up`, {
                     
 params: { 
expand_dropdowns: 
true, range: '0-100' 
},
                     
 headers
                  });
                  
followups = Array.isA
rray(fRes.data) ? 
fRes.data : [];
              } 
catch (e) { 
console.warn('No 
followups or error', 
e.message); }
  
              // 3. 
Soluciones 
(Solutions)
              let 
solutions = [];
              try {
                  
const sRes = await ax
ios.get(`${apiUrl}/Ti
cket/${id}/ITILSoluti
on`, {
                     
 params: { 
expand_dropdowns: 
true },
                     
 headers
                  });
                  
solutions = Array.isA
rray(sRes.data) ? 
sRes.data : [];
              } 
catch (e) { 
console.warn('No 
solutions or error', 
e.message); }
  
              // 4. 
Documentos
              let 
documents = [];
              try {
                  
const dRes = await ax
ios.get(`${apiUrl}/Ti
cket/${id}/Document_I
tem`, {
                     
 params: { 
expand_dropdowns: 
true },
                     
 headers
                  });
                  
documents = Array.isA
rray(dRes.data) ? 
dRes.data : [];
              } 
catch (e) { 
console.warn('No 
documents or error', 
e.message); }
  
              let 
actors = [];
              let 
groupActors = [];
  
              // 5a. 
Usuarios vinculados
              try {
                  
const aRes = await ax
ios.get(`${apiUrl}/Ti
cket/${id}/Ticket_Use
r`, { headers });
                  
actors = Array.isArra
y(aRes.data) ? 
aRes.data : 
(aRes.data ? 
[aRes.data] : []);
              } 
catch (e) {
                  
console.warn(`[GLPI] 
Ticket_User NO 
disponible mediante 
ruta anidada. 
Intentando b├║squeda 
alternativa...`);
                  
try {
                     
 // Intento 
alternativo via 
b├║squeda filtrada
                     
 const aResAlt = 
await axios.get(`${ap
iUrl}/Ticket_User`, {
                     
     params: { 
searchText: { 
tickets_id: id } },
                     
     headers
                     
 });
                     
 actors = Array.isArr
ay(aResAlt.data) ? 
aResAlt.data : [];
                  } 
catch (e2) {
                     
 console.error(`[GLPI
] Fallo total 
obteniendo 
Ticket_User para 
#${id}`);
                  }
              }
  
              // 5b. 
Grupos vinculados
              try {
                  
const gaRes = await a
xios.get(`${apiUrl}/T
icket/${id}/Ticket_Gr
oup`, { headers });
                  
groupActors = Array.i
sArray(gaRes.data) ? 
gaRes.data : 
(gaRes.data ? 
[gaRes.data] : []);
              } 
catch (e) {
                  
console.warn(`[GLPI] 
Ticket_Group NO 
disponible mediante 
ruta anidada. 
Intentando b├║squeda 
alternativa...`);
                  
try {
                     
 const gaResAlt = 
await axios.get(`${ap
iUrl}/Ticket_Group`, 
{
                     
     params: { 
searchText: { 
tickets_id: id } },
                     
     headers
                     
 });
                     
 groupActors = Array.
isArray(gaResAlt.data
) ? gaResAlt.data : 
[];
                  } 
catch (e2) {
                     
 console.error(`[GLPI
] Fallo total 
obteniendo 
Ticket_Group para 
#${id}`);
                  }
              }
  
              // 5. 
Normalizaci├│n 
b├ísica inicial para 
enriquecimiento
              const 
t = ticketRes.data;
  
              // 6. 
Enrich all users in 
timeline and actors 
with real names
              const 
userIdsToFetch = new 
Set();
              const 
getUserId = (val) => 
{
                  if 
(!val) return null;
                  if 
(typeof val === 
'object') return 
val.id || val["2"] 
|| val["8"] || null;
                  
return val;
              };
  
              if (t.u
sers_id_recipient) us
erIdsToFetch.add(getU
serId(t.users_id_reci
pient));
              if (t.u
sers_id_technician) u
serIdsToFetch.add(get
UserId(t.users_id_tec
hnician));
              
actors.forEach(a => {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              
console.log(`[GLPI] 
Creando soluci├│n 
para Ticket 
#${ticketId}`);
              // 
Tipo de soluci├│n 
por defecto (puede 
requerir ajuste 
seg├║n 
configuraci├│n GLPI)
              const 
solutionType = 1;
  
              const 
response = await axio
s.post(`${apiUrl}/ITI
LSolution`, {
                  
input: {
                     
 items_id: ticketId,
                     
 itemtype: 'Ticket',
                     
 content: content,
                     
 status: 2, // 
Aprobada/Propuesta
                     
 solutiontypes_id: 
solutionType
                  }
              }, {
                  
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
              });
  
              return 
response.data;
          } catch 
(error) {
              console
.error(`[GLPI] Error 
addSolution:`, 
error.message);
              throw 
error;
          }
      }
      /**
       * Actualiza 
un ticket
       */
      async 
updateTicket(id, 
input) {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              
console.log(`[GLPI] 
Actualizando Ticket 
#${id}`, input);
              const 
response = await axio
s.put(`${apiUrl}/Tick
et/${id}`, {
                  
input: {
                     
 id: id,
                     
 ...input
                  }
              }, {
                  
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
              });
  
              return 
response.data;
          } catch 
(error) {
              console
.error(`[GLPI] Error 
updateTicket:`, 
error.message);
              throw 
error;
          }
      }
  
      /**
       * Obtiene 
todos los usuarios 
(para solicitantes)
       */
      async 
getUsers() {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              const 
response = await axio
s.get(`${apiUrl}/User
`, {
                  
params: {
                     
 range: '0-1000',
                     
 is_active: 1,
                     
 is_deleted: 0
                  },
                  
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
              });
  
              const 
data = Array.isArray(
response.data) ? 
response.data : [];
              const 
result = data.map(u 
=> {
                  // 
Soporte para formato 
est├índar y formato 
num├®rico
                  
const fname = 
(u.firstname || 
u.first_name || 
u["9"] || '').trim();
                  
const rname = 
(u.realname || 
u.lastname || 
u.last_name || 
u["34"] || 
'').trim();
  
                  
let fullName = 
`${fname} 
${rname}`.trim();
                  if 
(!fullName) fullName 
= u.completename || 
u.name || u.login || 
u["1"] || 
String(u.id || 
u["2"] || 'N/A');
  
                  
const userObj = {
                     
 id: u.id || 'N/A',
                     
 name: u.name || 
u.login || (u.id || 
'N/A'),
                     
 fullName
                  };
  
                  thi
s.userCache.set(Strin
g(userObj.id), 
userObj);
                  thi
s.userCache.set(Numbe
r(userObj.id), 
userObj);
                  if 
(userObj.name) this.l
oginCache.set(String(
userObj.name).toLower
Case(), userObj);
  
                  
return userObj;
              });
              return 
result;
          } catch 
(error) {
              console
.error('[GLPI] Error 
getUsers:', 
error.message);
              return 
[];
          }
      }
      /**
       * Obtiene una 
lista gen├®rica de 
GLPI (Categor├¡as, 
Ubicaciones, etc)
       */
      async 
getItems(itemtype, 
criteria = {}) {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              const 
response = await axio
s.get(`${apiUrl}/${it
emtype}`, {
                  
params: {
                     
 range: '0-500',
                     
 is_deleted: 0,
                     
 ...criteria
                  },
                  
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
              });
              return 
Array.isArray(respons
e.data) ? 
response.data : [];
          } catch 
(error) {
              console
.error(`[GLPI] Error 
getItems(${itemtype})
:`, error.message);
              return 
[];
          }
      }
  
      /**
       * Obtiene 
grupos (para 
asignaci├│n)
       */
      async 
getGroups() {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          try {
              const 
response = await axio
s.get(`${apiUrl}/Grou
p`, {
                  
params: {
                     
 range: '0-500',
                     
 is_assign: 1, // 
Solo grupos 
asignables
                     
 is_deleted: 0
                  },
                  
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
              });
  
              const 
data = Array.isArray(
response.data) ? 
response.data : [];
              return 
data.map(g => ({
                  
id: g.id,
                  
name: g.name,
                  
fullName: 
g.completename || 
g.name,
                  
isGroup: true
              }));
          } catch 
(error) {
              console
.error('[GLPI] Error 
getGroups:', 
error.message);
              return 
[];
          }
      }
  
      /**
       * Actualiza o 
a├▒ade un actor a un 
ticket
       */
      async updateAct
or(ticketId, 
actorId, type, 
isGroup = false) {
>         if 
(!this.sessionToken) 
await 
this.initSession();
          const { 
apiUrl, appToken } = 
this.config;
  
          const 
itemtype = isGroup ? 
'Ticket_Group' : 
'Ticket_User';
          const 
idField = isGroup ? 
'groups_id' : 
'users_id';
  
          try {
              // 
Primero buscamos si 
ya existe un actor 
de ese tipo para no 
duplicar
              const 
actorsRes = await axi
os.get(`${apiUrl}/Tic
ket/${ticketId}/${ite
mtype}`, {
                  
headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
              });
              const 
existingActors = Arra
y.isArray(actorsRes.d
ata) ? 
actorsRes.data : [];
              const 
existing = existingAc
tors.find(a => 
a.type == type);
  
              if 
(existing) {
                  // 
Actualizar existente
                  
await axios.put(`${ap
iUrl}/Ticket/${ticket
Id}/${itemtype}/${exi
sting.id}`, {
                     
 input: { id: 
existing.id, 
[idField]: actorId, 
type: type }
                  }, 
{
                     
 headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
                  });
              } else 
{
                  // 
Crear nuevo
                  
await axios.post(`${a
piUrl}/Ticket/${ticke
tId}/${itemtype}`, {
                     
 input: { 
tickets_id: 
ticketId, [idField]: 
actorId, type: type }
                  }, 
{
                     
 headers: { 
'App-Token': 
appToken, 
'Session-Token': 
this.sessionToken }
                  });
              }
              return 
{ success: true };
          } catch 
(error) {
              console
.error(`[GLPI] Error 
updateActor:`, 
error.response?.data 
|| error.message);
              throw 
error;
          }
      }
  }
  
  export default new 
GLPIConnector();


