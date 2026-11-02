// @central-id projeto-30-acertos-automaticos-clientes-compras
// @central-name Projeto 30 — Acertos automáticos (Clientes + Compras)
// @central-version 1.0.1
// @central-match https://sistema.romancemoda.com.br/apex/*
// @central-enabled true

// Módulo gerado pela Central. Envie este arquivo para scripts/ no GitHub.
// Não instale individualmente no Tampermonkey.
(function(){
'use strict';
const AC_SCHEMA='projeto30-acertos-v1';
function acName(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\(inativ[oa]\)/gi,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
}
function acPeriod(text){
  const value=String(text||'');
  let match=value.match(/\b(\d{1,2})\s*\/\s*(20\d{2})\b/);
  if(match)return acValidPeriod(Number(match[1]),Number(match[2]));
  match=value.match(/Ano\s*:\s*(20\d{2})\s*,?\s*Semana\s*:\s*(\d{1,2})/i);
  return match?acValidPeriod(Number(match[2]),Number(match[1])):null;
}
function acValidPeriod(week,year){
  return Number.isInteger(week)&&week>=1&&week<=52&&Number.isInteger(year)&&year>=2000&&year<=2099?{week,year}:null;
}
function acInteger(text){
  const clean=String(text??'').replace(/\s/g,'');
  if(clean===''||/^[-–—]$/.test(clean))return 0;
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(clean))throw Error('Quantidade de Novas inválida: '+clean);
  const number=Number(clean.replace(/\./g,''));
  if(!Number.isSafeInteger(number)||number<0)throw Error('Quantidade de Novas fora do limite.');
  return number;
}
function acCents(text){
  const clean=String(text??'').replace(/R\$/gi,'').replace(/[\s\u00a0]/g,'');
  if(clean===''||/^[-–—]$/.test(clean))return 0;
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(clean))throw Error('Valor de Geral inválido: '+clean);
  const parts=clean.replace(/\./g,'').split(',');
  const number=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
  if(!Number.isSafeInteger(number)||number<0)throw Error('Valor de Geral fora do limite.');
  return number;
}
async function acHash(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
function acValidatePacket(raw){
  if(!raw||raw.schema!==AC_SCHEMA||!/^ac_[a-z0-9_]{16,100}$/i.test(raw.id||''))throw Error('Pacote de acertos inválido.');
  const period=acValidPeriod(Number(raw.period?.week),Number(raw.period?.year));
  if(!period)throw Error('Semana ou ano inválido: o painel trabalha com semanas 1 a 52.');
  if(raw.source?.host!=='sistema.romancemoda.com.br'||raw.source?.app!=='2001'||raw.source?.page!=='74')throw Error('Origem de acertos não reconhecida.');
  if(!Number.isFinite(raw.capturedAt)||raw.capturedAt<=0)throw Error('Data do envio inválida.');
  if(!Array.isArray(raw.rows)||!raw.rows.length||raw.rows.length>5000)throw Error('Lista de distribuidores vazia ou acima do limite.');
  const keys=new Set();
  const rows=raw.rows.map(row=>{
    if(!/^c[a-z0-9_]{1,30}_(?:r\d+|n[a-f0-9]{40})$/i.test(row.key||'')||keys.has(row.key))throw Error('Identificador repetido ou inválido.');
    keys.add(row.key);
    if(typeof row.name!=='string'||!row.name.trim()||row.name.length>240)throw Error('Nome de origem inválido.');
    if(!Number.isSafeInteger(row.clientes)||row.clientes<0||!Number.isSafeInteger(row.comprasCents)||row.comprasCents<0)throw Error('Valores de clientes/compras inválidos.');
    return {key:row.key,name:row.name.trim(),clientes:row.clientes,comprasCents:row.comprasCents};
  });
  return {schema:AC_SCHEMA,id:raw.id,capturedAt:raw.capturedAt,source:{host:raw.source.host,app:'2001',page:'74',company:String(raw.source.company||'').slice(0,100),companyId:String(raw.source.companyId||'').slice(0,30)},period:{...period,open:raw.period.open===true,label:String(raw.period.label||'').slice(0,100)},rows};
}
function acMissing(packet,mappings,distributors){
  const ids=new Set(distributors.map(d=>d.id));
  return packet.rows.filter(row=>{const m=mappings[row.key];return !m||(!m.ignore&&!ids.has(m.targetId));});
}
function acApplySnapshot(current,packet,mappings,stamp){
  const rows=JSON.parse(JSON.stringify((Array.isArray(current)?current:Object.values(current||{})).filter(row=>row&&typeof row.id==='string')));
  const missing=acMissing(packet,mappings,rows);
  if(missing.length)throw Error('Há nomes sem associação válida: '+missing.map(r=>r.name).join(', '));
  if(!Number.isFinite(stamp)||stamp<=0)throw Error('O envio ainda não recebeu a data do servidor.');
  const groups=new Map();
  for(const row of packet.rows){
    const mapping=mappings[row.key];
    if(mapping.ignore)continue;
    const item=groups.get(mapping.targetId)||{clientes:0,comprasCents:0,keys:[]};
    item.clientes+=row.clientes;item.comprasCents+=row.comprasCents;item.keys.push(row.key);
    if(!Number.isSafeInteger(item.clientes)||!Number.isSafeInteger(item.comprasCents))throw Error('Soma recebida acima do limite.');
    groups.set(mapping.targetId,item);
  }
  let applied=0,skipped=0;
  const {year,week}=packet.period;
  for(const [id,value] of groups){
    const target=rows.find(d=>d.id===id);
    const previous=target.acertosSync?.[year]?.[week];
    // Um reenvio já aplicado ou um lote atrasado nunca substitui o mais recente.
    if(previous&&(previous.id===packet.id||Number(previous.stamp)>=stamp)){skipped++;continue;}
    target.data??={};target.data[year]??={};target.data[year][week]=value.clientes;
    target.compras??={};target.compras[year]??={};target.compras[year][week]=value.comprasCents;
    target.acertosSync??={};target.acertosSync[year]??={};
    target.acertosSync[year][week]={id:packet.id,stamp,sourceKeys:value.keys.sort().join(',')};
    applied++;
  }
  return {rows,applied,skipped};
}

function acRepresentativeId(row){
  for(const link of row.querySelectorAll('a[href]')){
    let value=link.getAttribute('href')||'';
    for(let i=0;i<3;i++){try{value=decodeURIComponent(value);}catch{break;}}
    const match=value.match(/f\?p=([^&#]+)/i);
    if(!match)continue;
    const fields=match[1].split(':');
    const names=(fields[6]||'').split(','),values=(fields[7]||'').split(',');
    const index=names.findIndex(name=>/_IDREPRESENTANTE$/.test(name));
    if(index>=0&&/^\d+$/.test(values[index]||''))return values[index];
  }
  return null;
}
function acReportTable(doc){
  return [...doc.querySelectorAll('table.a-IRR-table')].find(table=>{
    const heads=[...table.querySelectorAll('th')];
    return [['Distribuidor','REPRESENTANTE'],['Novas','QTDNOTASNOVAS'],['Geral','TOTALGERAL']].every(([name,id])=>heads.some(h=>h.id===id||acName(h.textContent)===acName(name)));
  })||null;
}
async function acExtractReport(doc){
  const select=doc.getElementById('P0_IDFECHAMENTO');
  const selected=select?.selectedOptions?.[0];
  const period=acPeriod(selected?.textContent);
  if(!period)throw Error('Selecione um fechamento de uma única semana (1 a 52). “Ver Tudo” não é um período válido.');
  const table=acReportTable(doc);
  if(!table)throw Error('Aguardando o relatório com Distribuidor, Novas e Geral.');
  const heads=[...table.querySelectorAll('th')];
  const column=(name,fallback)=>heads.find(h=>acName(h.textContent)===acName(name))?.id||fallback;
  const columns={name:column('Distribuidor','REPRESENTANTE'),clientes:column('Novas','QTDNOTASNOVAS'),compras:column('Geral','TOTALGERAL'),period:column('Ref A','Referente a')};
  const region=table.closest('.a-IRR-container')||table.parentElement;
  const enabledPageButton=[...region.querySelectorAll('.a-IRR-pagination-item')].some(item=>!item.classList.contains('is-disabled')&&item.querySelector('button,a'));
  if(enabledPageButton)throw Error('O relatório está paginado. Aguarde carregar “Tudo” antes do envio.');
  const companySelect=doc.getElementById('P0_IDFILIAL');
  const companyId=String(companySelect?.value||'sem_empresa');
  if(!/^[a-z0-9_]{1,30}$/i.test(companyId))throw Error('Empresa não identificada.');
  const groups=new Map();
  let dataRows=0;
  for(const tr of table.querySelectorAll('tr')){
    if(tr.querySelector('td.a-IRR-aggregate'))continue;
    const cells=[...tr.querySelectorAll('td[headers]')];
    // O APEX desta página usa inclusive IDs com espaço, como “Referente a”.
    const cell=id=>cells.find(td=>(' '+(td.getAttribute('headers')||'').replace(/\s+/g,' ')+' ').includes(' '+id+' '));
    const nameCell=cell(columns.name),clientCell=cell(columns.clientes),moneyCell=cell(columns.compras);
    if(!nameCell&&!clientCell&&!moneyCell)continue;
    if(!nameCell||!clientCell||!moneyCell)throw Error('Linha incompleta no relatório; o envio foi adiado.');
    const name=nameCell.textContent.replace(/\s+/g,' ').trim();
    if(!name)continue;
    const ref=cell(columns.period);
    if(!ref)throw Error('A coluna Ref A precisa estar visível para conferir a semana dos valores.');
    const rowPeriod=acPeriod(ref.textContent);
    if(!rowPeriod||rowPeriod.week!==period.week||rowPeriod.year!==period.year)throw Error('A semana da tabela ainda não corresponde ao fechamento selecionado. Aguarde a atualização.');
    const rep=acRepresentativeId(tr);
    const key=rep?`c${companyId}_r${rep}`:`c${companyId}_n${(await acHash(acName(name))).slice(0,40)}`;
    const item=groups.get(key)||{key,name,clientes:0,comprasCents:0};
    item.clientes+=acInteger(clientCell.textContent);
    item.comprasCents+=acCents(moneyCell.textContent);
    if(!Number.isSafeInteger(item.clientes)||!Number.isSafeInteger(item.comprasCents))throw Error('Soma acima do limite.');
    groups.set(key,item);dataRows++;
  }
  if(!dataRows)throw Error('Nenhum distribuidor com dados foi encontrado no relatório.');
  const rows=[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
  const source={host:'sistema.romancemoda.com.br',app:'2001',page:'74',company:companySelect?.selectedOptions?.[0]?.textContent.trim()||companyId,companyId};
  const label=selected.textContent.replace(/\s+/g,' ').trim();
  const fingerprint=await acHash(JSON.stringify({source,period,rows}));
  return {schema:AC_SCHEMA,id:'ac_'+fingerprint.slice(0,48),capturedAt:Date.now(),source,period:{...period,label,open:/\baberto\b/i.test(label)},rows};
}

const AC_DB='https://acompanhamentos-reta-final-default-rtdb.firebaseio.com';
const AC_QUEUE='acompanhamento_30_notas_por_ciclo/principal/acertos_auto/lotes';
if(location.hostname!=='sistema.romancemoda.com.br'||document.getElementById('pFlowId')?.value!=='2001'||document.getElementById('pFlowStepId')?.value!=='74')return;
let acSending=false,acTimer=0,acLastPacket=null,acLastError='',acAcknowledgement=0;
const acUi=document.createElement('span');
acUi.id='p30-acertos-sender';
acUi.style.cssText='display:inline-flex;order:1000;align-items:center;flex-wrap:wrap;gap:7px;margin-left:8px;vertical-align:middle;font:12px Segoe UI,Arial,sans-serif';
const acSendButton=document.createElement('button');
acSendButton.type='button';acSendButton.textContent='Enviar dados';
acSendButton.style.cssText='border:1px solid #83cbb1;background:#e6f7ef;color:#08683c;border-radius:7px;padding:8px 10px;cursor:pointer;font-weight:700';
const acStatus=document.createElement('span');acStatus.setAttribute('role','status');acStatus.setAttribute('aria-live','polite');
acStatus.style.cssText='max-width:340px;white-space:normal;line-height:1.35;color:#46546b';
acUi.append(acSendButton,acStatus);
// O APEX define a ordem visual dos campos flex; o bloco deve vir após o seletor.
document.getElementById('P0_IDFECHAMENTO')?.after(acUi);
function acSetStatus(text,error=false){
  if(acStatus.textContent!==text)acStatus.textContent=text;
  acStatus.style.color=error?'#b85b0a':'#08683c';
  acStatus.title=text;
}
function acRequest(method,path,data,headers={}){
  return new Promise((resolve,reject)=>GM_xmlhttpRequest({
    method,url:AC_DB+'/'+path+'.json',timeout:20000,
    headers:{'Content-Type':'application/json',...headers},
    data:data===undefined?undefined:JSON.stringify(data),
    onload(response){
      if(response.status<200||response.status>=300){const e=Error('Firebase respondeu '+response.status+'. Verifique a conexão e as permissões do recebimento.');e.status=response.status;reject(e);return;}
      try{resolve({value:response.responseText?JSON.parse(response.responseText):null,headers:response.responseHeaders||''});}catch{reject(Error('Resposta inválida do recebimento.'));}
    },
    onerror:()=>reject(Error('Não foi possível enviar ao Firebase. Use Enviar dados para tentar novamente.')),
    ontimeout:()=>reject(Error('O envio demorou demais. Use Enviar dados para tentar novamente.'))
  }));
}
function acEnsureAllRows(){
  const table=acReportTable(document),region=table?.closest('.a-IRR-container');
  if(!region)return true;
  const partial=[...region.querySelectorAll('.a-IRR-pagination-item')].some(item=>!item.classList.contains('is-disabled')&&item.querySelector('button,a'));
  if(!partial)return true;
  const selector=region.querySelector('.a-IRR-rowSelector select');
  const all=selector&&[...selector.options].find(option=>/^(tudo|todos)$/i.test(option.textContent.trim()));
  if(!all)throw Error('Há mais páginas no relatório. Selecione Linhas = Tudo e clique em Enviar dados.');
  if(selector.value!==all.value){
    selector.value=all.value;
    const jq=unsafeWindow.apex?.jQuery;
    if(jq)jq(selector).trigger('change');else selector.dispatchEvent(new Event('change',{bubbles:true}));
  }
  acSetStatus('Carregando todas as linhas do relatório…');
  return false;
}
async function acWatchReceipt(id,attempt=0){
  clearTimeout(acAcknowledgement);
  if(attempt>12)return;
  acAcknowledgement=setTimeout(async()=>{
    try{
      const {value}=await acRequest('GET',AC_QUEUE+'/'+id);
      if(value?.status==='processed'){
        acSetStatus('Importado no HTML • '+(value.applied||0)+' distribuidor(es) atualizado(s).');return;
      }
      if(value?.status==='needs_mapping')acSetStatus('Recebido • associe os nomes no modal do HTML.');
      else if(value?.error)acSetStatus('Recebido • o HTML informa: '+value.error,true);
      else acSetStatus('Enviado • aguardando o HTML aberto para aplicar.');
      acWatchReceipt(id,attempt+1);
    }catch(e){acSetStatus('Enviado; não foi possível consultar o reconhecimento.',true);}
  },5000);
}
async function acSend(manual=false){
  if(acSending)return;
  acSending=true;acSendButton.disabled=true;
  try{
    if(!acEnsureAllRows()){acSchedule();return;}
    const region=acReportTable(document)?.closest('.a-IRR-container');
    if(region&&[...region.querySelectorAll('.u-Processing,[aria-busy="true"]')].some(el=>el.getClientRects().length))throw Error('Aguarde o relatório terminar de atualizar.');
    const first=await acExtractReport(document);
    await new Promise(resolve=>setTimeout(resolve,700));
    const packet=await acExtractReport(document);
    if(first.id!==packet.id)throw Error('Os valores estão mudando. O envio será tentado quando o relatório estabilizar.');
    const signature=packet.id;
    if(!manual&&GM_getValue('p30_last_signature','')===signature){
      if(!acLastPacket){acSetStatus('Dados desta semana já enviados.');acLastPacket=packet;acWatchReceipt(GM_getValue('p30_last_job_id',signature));}
      else if(acLastError)acSetStatus('Dados já enviados para esta semana.');
      acLastError='';return;
    }
    if(manual)packet.id+='_'+Date.now().toString(36);
    acLastPacket=acValidatePacket(packet);GM_setValue('p30_last_packet',acLastPacket);
    acSetStatus('Enviando '+packet.rows.length+' distribuidores • semana '+packet.period.week+'/'+packet.period.year+'…');
    const path=AC_QUEUE+'/'+packet.id;
    const existing=await acRequest('GET',path,undefined,{'X-Firebase-ETag':'true'});
    if(existing.value===null){
      const etag=existing.headers.match(/^etag:\s*(.+)$/im)?.[1]?.trim();
      if(!etag)throw Error('O servidor não confirmou o controle de duplicidade. Tente Enviar dados novamente.');
      try{
        await acRequest('PUT',path,{payload:packet,createdAt:{'.sv':'timestamp'},status:'pending'},{'if-match':etag});
      }catch(e){if(e.status!==412)throw e;}
    }
    GM_setValue('p30_last_signature',signature);GM_setValue('p30_last_job_id',packet.id);acLastError='';
    acSetStatus(existing.value?.status==='processed'?'Estes dados já foram importados no HTML.':'Enviado • semana '+packet.period.week+'/'+packet.period.year+' • aguardando o HTML.');
    acWatchReceipt(packet.id);
  }catch(e){acLastError=e.message||String(e);acSetStatus(acLastError,true);}
  finally{acSending=false;acSendButton.disabled=false;}
}
function acSchedule(){clearTimeout(acTimer);acTimer=setTimeout(()=>acSend(false),1600);}
acSendButton.addEventListener('click',()=>acSend(true));
document.getElementById('P0_IDFECHAMENTO')?.addEventListener('change',acSchedule);
const acObserver=new MutationObserver(records=>{
  if(records.some(record=>!acUi.contains(record.target)))acSchedule();
});
const acObservedRegion=acReportTable(document)?.closest('.a-IRR-container')||document.body;
acObserver.observe(acObservedRegion,{childList:true,subtree:true,characterData:true});
try{unsafeWindow.apex?.jQuery?.(document).on('apexafterrefresh.p30acertos',acSchedule);}catch{}
GM_registerMenuCommand('Enviar acertos desta semana agora',()=>acSend(true));
GM_registerMenuCommand('Baixar último lote JSON',()=>{
  const packet=acLastPacket||GM_getValue('p30_last_packet',null);
  if(!packet){acSetStatus('Ainda não há um lote válido para baixar.',true);return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`acertos-${packet.period.year}-semana-${packet.period.week}.json`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
});
acSetStatus('Envio automático ativo • aguardando o relatório…');
acSchedule();setInterval(acSchedule,15000);

})();
