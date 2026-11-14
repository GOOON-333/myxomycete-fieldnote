const $=id=>document.getElementById(id);const FIELDS=['number','date','event','collector','species','specimenStatus','prefecture','locality','latitude','longitude','accuracy','altitude','altitudeAccuracy','forest','treeType','treeDetail','substrate','substrateDetail','decay','moss','position','height','overview','notes'];const GROUPS={forest:'樹林',tree:'基物樹種',substrate:'基物',decay:'腐朽型',moss:'コケ上',position:'発生位置',height:'発生高さ',diameters:'太さ',ph:'pH',hardness:'硬さ'};const MEAS={diameters:1,ph:1,hardness:1};let db,currentId=null,photos=[],previous=null,settings={visible:{},defaultCollector:'',gpsDuration:15},dirtyTimer,seq=0;const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);const nowDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function alertMsg(t,ok=true){let n=$('message');n.textContent=t;n.className='notice'+(ok?' ok':'');window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>n.classList.add('hidden'),5500)}
// Preserve all individual measurements; remove average displays and CSV columns.
queueMicrotask(()=>{
    // Align the new event field before removing legacy average columns.
    if(csvNames.length===csvFields.length-1)csvNames.splice(2,0,'イベント');
    for(const key of ['diameters','ph','hardness'])$(key+'Mean')?.remove();
    for(let i=csvFields.length-1;i>=0;i--){
        if(['diametersMean','phMean','hardnessMean'].includes(csvFields[i])){
            csvFields.splice(i,1);csvNames.splice(i,1);
        }
    }
});
const measurementHeadingStyle=document.createElement('style');
measurementHeadingStyle.textContent='[data-config="diameters"] > label,[data-config="ph"] > label,[data-config="hardness"] > label{font-size:18px;font-weight:800;line-height:1.5;color:#183e33;margin:22px 0 10px;letter-spacing:.01em}';
document.head.append(measurementHeadingStyle);
function addAltitudeControls(){const container=document.createElement('div');container.className='grid';container.style.marginTop='12px';container.innerHTML='<div class="field"><label for="altitude">標高（m・手動修正可）</label><input type="number" step="any" id="altitude" placeholder="未取得"></div><div class="field"><label for="altitudeAccuracy">垂直精度（±m）</label><input type="number" step="any" min="0" id="altitudeAccuracy" placeholder="未取得"></div><div class="field full"><label for="gpsDuration">GPS測位時間</label><select id="gpsDuration"><option value="5">5秒 — 省電力</option><option value="15">15秒 — 標準</option><option value="30">30秒 — 精度重視</option></select><div class="small">緯度・経度と標高を同時に取得します。iPhoneの環境によっては標高が取得できません。</div></div>'; $('gpsStatus').before(container);$('gpsDuration').value=String([5,15,30].includes(+settings.gpsDuration)?settings.gpsDuration:15);$('gpsDuration').addEventListener('change',async()=>{settings.gpsDuration=+$('gpsDuration').value;await put('meta',settings,'settings')})}
function addSpecimenControls(){let field=document.createElement('div');field.className='field';field.innerHTML='<label for="specimenStatus">標本の有無</label><select id="specimenStatus"><option value="">未選択</option><option value="標本あり">標本あり</option><option value="記録のみ">記録のみ</option></select>';const species=$('species').closest('.field');species.after(field);setupEventLayout();layoutGpsFields();layoutSubstrateDetail();enhanceChoiceFields();enhancePhotoControls()}
function layoutSubstrateDetail(){
    const detail=$('substrateDetail');
    const heightField=$('height').closest('.field');
    const field=document.createElement('div');
    field.className='field';
    field.innerHTML='<label for="substrateDetail">補足・その他</label>';
    detail.style.marginTop='0';
    field.append(detail);
    heightField.before(field);
}
function enhancePhotoControls(){
    const picker=$('photoInput');
    const camera=document.createElement('input');
    camera.type='file';camera.accept='image/*';camera.capture='environment';camera.id='cameraInput';
    camera.hidden=true;picker.hidden=true;
    const actions=document.createElement('div');actions.className='actions';
    const take=document.createElement('button');take.type='button';take.className='button secondary';take.textContent='📷 写真を撮影';take.onclick=()=>camera.click();
    const choose=document.createElement('button');choose.type='button';choose.className='button secondary';choose.textContent='🖼 写真を選ぶ';choose.onclick=()=>picker.click();
    actions.append(take,choose);picker.after(camera,actions);
    camera.onchange=e=>{attach(e.target.files);camera.value=''};
}
function layoutGpsFields(){
    const grid=$('latitude').closest('.grid');
    const extra=$('altitude').closest('.grid');
    for(const id of ['gpsButton','altitude','latitude','longitude','accuracy','altitudeAccuracy','gpsDuration']){
        const field=$(id).closest('.field');
        if(id==='gpsDuration')field.classList.add('full');
        grid.append(field);
    }
    extra.remove();
    $('gpsDuration').closest('.field').querySelector('label').textContent='測位時間';
}
function setupEventLayout(){
    const grid=$('number').closest('.grid');
    const event=document.createElement('div');
    event.className='field full';
    event.innerHTML='<label for="event">イベント</label><div class="measure-row"><input id="event" placeholder="例：横倉山調査会"><button type="button" data-copy="event" title="前回値">↶</button></div>';
    for(const id of ['number','date'])grid.append($(id).closest('.field'));
    grid.append(event);
    for(const id of ['prefecture','locality','collector','specimenStatus'])grid.append($(id).closest('.field'));
    const species=$('species').closest('.field');species.classList.add('full');grid.append(species);
}
// Mobile-friendly direct choices and type-ahead suggestions.
function enhanceChoiceFields(){
    const style=document.createElement('style');
    style.textContent=`
      .grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
      .field{min-width:0;max-width:100%}
      .choice-group{display:flex;gap:6px;flex-wrap:wrap}
      .choice-pill{display:inline-flex;align-items:center;justify-content:center;flex:1;white-space:nowrap;gap:5px;border:1px solid #bdd2c3;background:#f7faf6;color:#285b45;padding:11px 7px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;min-height:44px}
      .choice-pill.is-selected{background:#285b45;color:white;border-color:#285b45}
      .choice-pill input{width:0;height:0;min-height:0;opacity:0;position:absolute}
      .suggest-wrap{position:relative;min-width:0}
      .suggest-wrap input{width:100%;min-width:0;font-size:16px}
      .suggestions{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 3px);background:white;border:1px solid #b6cdbb;border-radius:11px;box-shadow:0 8px 24px #173e3326;max-height:230px;overflow:auto}
      .suggestions button{display:block;width:100%;padding:12px;text-align:left;background:white;color:#234b37;border:0;border-bottom:1px solid #edf2ec;font-size:14px}
      .suggestions button:last-child{border-bottom:0}
      .suggestions button:active{background:#e5eee5}
      @media(max-width:600px){
        .number-field,.date-field{grid-column:auto!important;min-width:0!important}
        .date-field input,#date{display:block;min-width:0!important;max-width:100%!important;width:100%!important;font-size:14px!important;padding:9px 6px!important;box-sizing:border-box!important;min-height:44px}
        .number-field input{min-width:0;font-size:14px;padding:9px 6px}
      }
    `;
    document.head.append(style);
    // The iOS native date control can have an intrinsic width larger than its column.
    // Keep the ISO date editable as text on phone screens to avoid horizontal overflow.
    if(window.matchMedia('(max-width:600px)').matches){
        const previous=$('date');
        const replacement=document.createElement('input');
        replacement.id='date';replacement.type='text';replacement.inputMode='numeric';
        replacement.placeholder='YYYY-MM-DD';replacement.autocomplete='off';
        replacement.setAttribute('aria-label','日付（年-月-日）');
        replacement.value=previous.value;
        previous.replaceWith(replacement);
    }
    const radioFields={specimenStatus:['標本あり','記録のみ'],moss:['はい','いいえ']};
    for(const [id,choices] of Object.entries(radioFields)){
        const original=$(id),group=document.createElement('div'),hidden=document.createElement('input');
        hidden.type='hidden';hidden.id=id;hidden.value=original.value;
        group.className='choice-group';group.dataset.forField=id;
        for(const value of choices){
            const label=document.createElement('label');label.className='choice-pill';
            const radio=document.createElement('input');radio.type='radio';radio.name=id+'Choice';radio.value=value;
            label.append(radio,document.createTextNode(value));
            label.addEventListener('click',e=>{
                e.preventDefault();hidden.value=value;refreshChoiceFields();
                hidden.dispatchEvent(new Event('input',{bubbles:true}));
            });
            group.append(label);
        }
        original.replaceWith(hidden);hidden.after(group);
    }
    for(const id of ['treeType','substrate','decay','position','photoCategory']){
        const original=$(id),values=[...original.options].map(o=>o.value).filter(Boolean),wrap=document.createElement('div'),input=document.createElement('input'),list=document.createElement('div');
        wrap.className='suggest-wrap';list.className='suggestions hidden';
        input.id=id;input.type='text';input.autocomplete='off';input.placeholder='入力または候補をタップ';
        input.value=original.value;input.setAttribute('aria-label',original.closest('.field')?.querySelector('label')?.textContent||id);
        function show(){
            const q=input.value.trim();list.innerHTML='';
            const matches=values.filter(v=>!q||v.includes(q));
            for(const value of (matches.length?matches:values)){
                const btn=document.createElement('button');btn.type='button';btn.textContent=value;
                btn.addEventListener('pointerdown',e=>{e.preventDefault();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));list.classList.add('hidden');input.blur()});
                list.append(btn);
            }
            list.classList.remove('hidden');
        }
        input.addEventListener('focus',show);
        input.addEventListener('input',show);
        input.addEventListener('blur',()=>setTimeout(()=>list.classList.add('hidden'),220));
        wrap.append(input,list);original.replaceWith(wrap);
    }
    document.addEventListener('pointerdown',e=>{if(!e.target.closest('.suggest-wrap'))document.querySelectorAll('.suggestions').forEach(x=>x.classList.add('hidden'))});
}
function refreshChoiceFields(){
    for(const group of document.querySelectorAll('.choice-group')){
        const selected=$(group.dataset.forField)?.value;
        for(const label of group.querySelectorAll('.choice-pill')){
            const radio=label.querySelector('input');radio.checked=radio.value===selected;
            label.classList.toggle('is-selected',radio.checked);
        }
    }
}
function openDB(){return new Promise((res,rej)=>{let r=indexedDB.open('myxomycete-fieldnote',1);r.onupgradeneeded=()=>{let d=r.result;if(!d.objectStoreNames.contains('records'))d.createObjectStore('records',{keyPath:'id'});if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}function dbop(store,method,...args){return new Promise((res,rej)=>{let t=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite'),r=t.objectStore(store)[method](...args);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}const getAll=s=>dbop(s,'getAll');const put=(s,v,key)=>key===undefined?dbop(s,'put',v):dbop(s,'put',v,key);const del=(s,id)=>dbop(s,'delete',id);
function tab(name){document.querySelectorAll('.view').forEach(e=>e.classList.toggle('hidden',e.id!==name));document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));if(name==='records')renderRecords();if(name==='settings')renderSettings();window.scrollTo(0,0)}
function renderMeasures(k,values){let el=$(k+'Rows');el.innerHTML='';(values||Array(MEAS[k]).fill('')).forEach(v=>{let row=document.createElement('div');row.className='measure-row';let input=document.createElement('input');input.type='number';input.step='any';input.placeholder=`地点 ${el.children.length+1}`;input.value=v??'';input.addEventListener('input',draftSoon);let btn=document.createElement('button');btn.textContent='×';btn.type='button';btn.title='地点を削除';btn.onclick=()=>{row.remove();draftSoon()};row.append(input,btn);el.append(row)})}function measure(k){return [...$(k+'Rows').querySelectorAll('input')].map(x=>x.value)}
async function nextNumber(){let all=await getAll('records');let today=nowDate().replaceAll('-','');let highest=all.reduce((max,r)=>{const match=String(r.number||'').match(new RegExp('^'+today+'-(\\d+)$'));return match?Math.max(max,+match[1]):max},0);seq=Math.max(seq,highest)+1;return today+'-'+String(seq).padStart(3,'0')}
function collect(){let r={id:currentId||uid(),updatedAt:new Date().toISOString()};FIELDS.forEach(k=>r[k]=$(k).value);for(let k in MEAS)r[k]=measure(k);r.photoIds=photos.map(p=>p.id);return r}
function fill(r){currentId=r.id||null;FIELDS.forEach(k=>$(k).value=r[k]??'');for(let k in MEAS)renderMeasures(k,r[k]);refreshChoiceFields();$('formTitle').textContent=currentId?'記録を編集':'新規採集記録';}
async function fresh(){clearTimeout(dirtyTimer);const number=await nextNumber();photos=[];renderPhotos();fill({number,date:nowDate(),collector:settings.defaultCollector||previous?.collector||'',prefecture:previous?.prefecture||'',locality:previous?.locality||'',forest:previous?.forest||''});await dbop('meta','delete','draft');$('draftStatus').textContent='新規記録の入力を開始しました。';tab('edit')}
async function save(){try{clearTimeout(dirtyTimer);let r=collect();r.number=r.number.trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date)))throw Error('日付をYYYY-MM-DD形式で入力してください');if(!r.number)throw Error('記録番号を入力してください');const duplicates=(await getAll('records')).filter(other=>other.id!==r.id&&String(other.number).trim()===r.number);if(duplicates.length){alertMsg('この記録番号は既に使用されています。別の番号を入力してください。',false);$('number').focus();return}for(const p of photos){if(p.blob)await put('photos',{id:p.id,blob:p.blob,category:p.category,name:p.name,type:p.type||p.blob.type})}await put('records',r);currentId=r.id;previous=r;await put('meta',{...r},'previous');await fresh();alertMsg('記録を保存しました。次の新規ノートを開きました');}catch(e){alertMsg('保存できませんでした：'+e.message,false)}}
function draftSoon(){clearTimeout(dirtyTimer);dirtyTimer=setTimeout(async()=>{try{await put('meta',{record:collect(),photos:photos.filter(p=>p.blob)},'draft');$('draftStatus').textContent='下書き保存：'+new Date().toLocaleTimeString('ja-JP')}catch(e){$('draftStatus').textContent='下書きを保存できません：容量を確認してください'}},600)}
async function attach(files){try{for(let f of files){if(!f.type.startsWith('image/'))continue;const id=uid();photos.push({id,blob:f,category:$('photoCategory').value,name:f.name||id+'.jpg',type:f.type})}renderPhotos();draftSoon()}catch(e){alertMsg('写真の追加に失敗：'+e.message,false)}$('photoInput').value=''}
function renderPhotos(){let root=$('photoGrid');root.innerHTML='';photos.forEach(p=>{let div=document.createElement('div');div.className='photo';const img=document.createElement('img');let url=URL.createObjectURL(p.blob);img.src=url;img.onload=()=>URL.revokeObjectURL(url);let meta=document.createElement('div');meta.className='meta';let sel=document.createElement('select');['野外','子実体','顕微鏡','その他'].forEach(c=>{let opt=document.createElement('option');opt.textContent=c;sel.append(opt)});sel.value=p.category;sel.onchange=()=>{p.category=sel.value;draftSoon()};let name=document.createElement('div');name.textContent=p.name;name.style.overflowWrap='anywhere';let b=document.createElement('button');b.textContent='削除';b.onclick=async()=>{photos=photos.filter(x=>x.id!==p.id);if(currentId)await del('photos',p.id);renderPhotos();draftSoon()};meta.append(sel,name);div.append(img,meta,b);root.append(div)})}
async function editRecord(id){let r=await dbop('records','get',id);if(!r)return;photos=[];for(let pid of (r.photoIds||[])){let p=await dbop('photos','get',pid);if(p)photos.push(p)}fill(r);renderPhotos();tab('edit')}
async function removeRecord(id){if(!confirm('この記録と添付写真を削除しますか？ この操作は取り消せません。'))return;let r=await dbop('records','get',id);for(let p of r?.photoIds||[])await del('photos',p);await del('records',id);renderRecords();alertMsg('記録を削除しました')}
async function renderRecords(){let list=$('recordList');let q=$('search').value.toLowerCase(),all=(await getAll('records')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));$('recordCount').textContent=all.length+'件';list.innerHTML='';all.filter(r=>[r.number,r.date,r.species,r.collector,r.locality,r.prefecture].join(' ').toLowerCase().includes(q)).forEach(r=>{let d=document.createElement('div');d.className='record';d.innerHTML=`<strong>${esc(r.species||'未同定')} <span class="pill">${esc(r.number)}</span></strong><div class="small">${esc(r.date)} · ${esc(r.prefecture)} ${esc(r.locality)} · ${esc(r.collector)} · 写真 ${(r.photoIds||[]).length}枚</div>`;let row=document.createElement('div');row.className='actions';let edit=document.createElement('button');edit.className='button secondary';edit.textContent='編集';edit.onclick=()=>editRecord(r.id);let copy=document.createElement('button');copy.className='button ghost';copy.textContent='複製';copy.onclick=async()=>{await editRecord(r.id);currentId=null;$('number').value=await nextNumber();photos=photos.map(p=>({...p,id:uid()}));renderPhotos();$('formTitle').textContent='新規採集記録（複製）'};let remove=document.createElement('button');remove.className='button danger';remove.textContent='削除';remove.onclick=()=>removeRecord(r.id);row.append(edit,copy,remove);d.append(row);list.append(d)});if(!list.children.length)list.innerHTML='<div class="empty">該当する記録はありません</div>'}
function renderSettings(){$('defaultCollector').value=settings.defaultCollector||'';let target=$('visibilityOptions');target.innerHTML='';for(let [k,label] of Object.entries(GROUPS)){let l=document.createElement('label');l.className='toggle';let i=document.createElement('input');i.type='checkbox';i.checked=settings.visible[k]!==false;i.dataset.visible=k;l.append(i,document.createTextNode(label));target.append(l)}}function visibility(){for(let e of document.querySelectorAll('[data-config]'))e.classList.toggle('hidden',settings.visible[e.dataset.config]===false);if($('gpsDuration'))$('gpsDuration').value=String([5,15,30].includes(+settings.gpsDuration)?settings.gpsDuration:15)}
function csvEscape(v){let s=String(v??'');return '"'+s.replaceAll('"','""')+'"'}const csvFields=[...FIELDS,'diameters','diametersMean','ph','phMean','hardness','hardnessMean','photoFiles','photoCategories','id'];const csvNames=['記録番号','日付','採取者','種名','都道府県','市町村・地点名','緯度','経度','GPS精度m','標高m','垂直精度m','樹林','基物樹種区分','基物樹種詳細','基物','基物詳細','腐朽型','コケ上','発生位置','発生高さcm','調査概要','備考','太さ各地点cm','太さ平均cm','pH各地点','pH平均','硬さ各地点','硬さ平均','写真ファイル名','写真分類','内部ID'];function photoFilename(r,p,index){let ext=(p.name||'').split('.').pop().replace(/[^a-z0-9]/gi,'').toLowerCase();if(!['jpg','jpeg','png','webp','heic','gif'].includes(ext))ext='jpg';return `${(r.number||'record').replace(/[^0-9a-z-]/gi,'_')}_${String(index+1).padStart(2,'0')}_${p.id.slice(0,8)}.${ext}`}async function exportRows(){let records=await getAll('records'),allPhotos=await getAll('photos'),lookup=new Map(allPhotos.map(p=>[p.id,p]));let rows=records.map(r=>{let pics=(r.photoIds||[]).map((id,i)=>({p:lookup.get(id),index:i})).filter(x=>x.p);let photoFiles=pics.map(x=>photoFilename(r,x.p,x.index));let obj={...r,photoFiles:photoFiles.join('; '),photoCategories:pics.map(x=>x.p.category).join('; ')};return csvFields.map(k=>Array.isArray(obj[k])?obj[k].join('; '):obj[k]??'')});let csv='\ufeff'+[csvNames,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');return{records,allPhotos,csv,lookup}}
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function makeBackup(data){let encoded=[];for(let p of data.allPhotos){let array=new Uint8Array(await p.blob.arrayBuffer());let parts=[];for(let i=0;i<array.length;i+=16384)parts.push(String.fromCharCode(...array.subarray(i,i+16384)));encoded.push({id:p.id,name:p.name,category:p.category,type:p.type||p.blob.type,data:btoa(parts.join(''))})}return JSON.stringify({format:'myxofield-backup',version:1,exportedAt:new Date().toISOString(),records:data.records,photos:encoded})}
// ZIP store method: no network dependencies, with CRC32 and UTF-8 filenames.
const encoder=new TextEncoder();const u16=(d,o,v)=>d.setUint16(o,v,true),u32=(d,o,v)=>d.setUint32(o,v>>>0,true);let crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});function crc32(bytes){let c=0xffffffff;for(let b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}function zip(files){let parts=[],central=[],offset=0;for(let f of files){let name=encoder.encode(f.name),data=f.data,crc=crc32(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x800);u16(v,8,0);u32(v,14,crc);u32(v,18,data.length);u32(v,22,data.length);u16(v,26,name.length);local.set(name,30);parts.push(local,data);let c=new Uint8Array(46+name.length),w=new DataView(c.buffer);u32(w,0,0x02014b50);u16(w,4,20);u16(w,6,20);u16(w,8,0x800);u32(w,16,crc);u32(w,20,data.length);u32(w,24,data.length);u16(w,28,name.length);u32(w,42,offset);c.set(name,46);central.push(c);offset+=local.length+data.length}let start=offset;for(let c of central){parts.push(c);offset+=c.length}let end=new Uint8Array(22),v=new DataView(end.buffer);u32(v,0,0x06054b50);u16(v,8,files.length);u16(v,10,files.length);u32(v,12,offset-start);u32(v,16,start);parts.push(end);return new Blob(parts,{type:'application/zip'})}
async function exportClick(type,button){try{button.disabled=true;let data=await exportRows(),stamp=nowDate().replaceAll('-','');if(type==='csv')download(new Blob([data.csv],{type:'text/csv;charset=utf-8'}),`変形菌調査記録_${stamp}.csv`);else if(type==='json')download(new Blob([await makeBackup(data)],{type:'application/json'}),`変形菌バックアップ_${stamp}.json`);else{let files=[{name:'records.csv',data:encoder.encode(data.csv)},{name:'backup.json',data:encoder.encode(await makeBackup(data))}];for(let r of data.records){for(let [i,id] of (r.photoIds||[]).entries()){let p=data.lookup.get(id);if(p)files.push({name:'photos/'+photoFilename(r,p,i),data:new Uint8Array(await p.blob.arrayBuffer())})}}download(zip(files),`変形菌調査_${stamp}.zip`)}alertMsg('ファイルを作成しました。「ファイル」に保存してください')}catch(e){alertMsg('書き出し失敗：'+e.message,false)}finally{button.disabled=false}}
async function restore(file){if(!file)return;try{let payload=JSON.parse(await file.text());if(payload.format!=='myxofield-backup'||!Array.isArray(payload.records)||!Array.isArray(payload.photos))throw Error('対応していないバックアップ形式です');if(!confirm(`${payload.records.length}件の記録を読み込みます。同じ内部IDは上書きします。よろしいですか？`))return;for(let p of payload.photos){let binary=atob(p.data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);await put('photos',{id:p.id,blob:new Blob([bytes],{type:p.type||'image/jpeg'}),type:p.type,name:p.name,category:p.category})}for(let r of payload.records)await put('records',r);alertMsg(`${payload.records.length}件の記録を復元しました`)}catch(e){alertMsg('復元できません：'+e.message,false)}$('restoreInput').value=''}
function gps(){if(!navigator.geolocation){alertMsg('この環境ではGPSを利用できません',false);return}const duration=+[5,15,30].find(v=>v===+$('gpsDuration').value)||15;let count=0,bestHorizontal=Infinity,bestVertical=Infinity,gotAltitude=false,finished=false;const button=$('gpsButton');$('gpsStatus').textContent=`GPS測位中… ${duration}秒間、水平・垂直精度を確認します`;button.disabled=true;let timer,watch;function stop(error){if(finished)return;finished=true;clearTimeout(timer);if(watch!==undefined)navigator.geolocation.clearWatch(watch);button.disabled=false;if(error){$('gpsStatus').textContent='GPS取得に失敗：'+error.message;return}$('gpsStatus').textContent=count?`測位完了（${count}回）／水平 ±${bestHorizontal.toFixed(1)}m／標高 ${gotAltitude?'取得済み':'取得不可'}${Number.isFinite(bestVertical)?'・垂直 ±'+bestVertical.toFixed(1)+'m':''}`:'測位時間内に位置情報を取得できませんでした'}watch=navigator.geolocation.watchPosition(pos=>{if(finished)return;count++;const {latitude,longitude,accuracy,altitude,altitudeAccuracy}=pos.coords;let changed=false;if(Number.isFinite(accuracy)&&accuracy<bestHorizontal){bestHorizontal=accuracy;$('latitude').value=latitude.toFixed(7);$('longitude').value=longitude.toFixed(7);$('accuracy').value=accuracy.toFixed(1);changed=true}if(Number.isFinite(altitude)){const verticalValid=Number.isFinite(altitudeAccuracy)&&altitudeAccuracy>=0;if(!gotAltitude||(verticalValid&&altitudeAccuracy<bestVertical)){gotAltitude=true;$('altitude').value=altitude.toFixed(1);$('altitudeAccuracy').value=verticalValid?altitudeAccuracy.toFixed(1):'';bestVertical=verticalValid?altitudeAccuracy:Infinity;changed=true}}if(changed)draftSoon();$('gpsStatus').textContent=`測位中 ${count}回／水平 ${Number.isFinite(bestHorizontal)?'±'+bestHorizontal.toFixed(1)+'m':'未取得'}／標高 ${gotAltitude?'取得済み':'未取得'}／残り最大${duration}秒`},e=>stop(e),{enableHighAccuracy:true,maximumAge:0,timeout:Math.max(20000,duration*1000)});timer=setTimeout(()=>stop(),duration*1000)}
async function init(){try{db=await openDB();settings=await dbop('meta','get','settings')||settings;previous=await dbop('meta','get','previous');let draft=await dbop('meta','get','draft');if(draft?.record){fill(draft.record);photos=draft.photos||[];for(let pid of draft.record.photoIds||[]){if(!photos.some(p=>p.id===pid)){let p=await dbop('photos','get',pid);if(p)photos.push(p)}}renderPhotos();$('draftStatus').textContent='前回の下書きを復元しました'}else await fresh();visibility()}catch(e){alertMsg('端末内データベースを開けません：'+e.message,false);return}document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));document.querySelectorAll('input,select,textarea').forEach(e=>{if(!['search','photoInput','restoreInput','defaultCollector'].includes(e.id))e.addEventListener('input',draftSoon)});document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{let k=b.dataset.copy;if(previous?.[k]!==undefined){$(k).value=previous[k];draftSoon()}});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{let k=b.dataset.add;renderMeasures(k,[...measure(k),'']);draftSoon()});$('photoInput').onchange=e=>attach(e.target.files);$('saveButton').onclick=save;$('newButton').onclick=()=>{if(confirm('新しい記録を開始しますか？ 現在の未保存入力は破棄されます。'))fresh()};$('search').oninput=renderRecords;$('gpsButton').onclick=gps;$('csvButton').onclick=e=>exportClick('csv',e.currentTarget);$('zipButton').onclick=e=>exportClick('zip',e.currentTarget);$('backupButton').onclick=e=>exportClick('json',e.currentTarget);$('restoreInput').onchange=e=>restore(e.target.files[0]);$('settingsSave').onclick=async()=>{settings.defaultCollector=$('defaultCollector').value;document.querySelectorAll('[data-visible]').forEach(i=>settings.visible[i.dataset.visible]=i.checked);await put('meta',settings,'settings');visibility();alertMsg('設定を保存しました')};if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./sw.js');$('offlineStatus').textContent='オフライン用キャッシュが登録されました。'}catch(e){$('offlineStatus').textContent='キャッシュ登録に失敗：'+e.message}}else $('offlineStatus').textContent='このブラウザではオフラインキャッシュが利用できません';}
csvNames.splice(4,0,'標本の有無');addAltitudeControls();addSpecimenControls();$('number').removeAttribute('readonly');$('number').setAttribute('autocomplete','off');const numberHint=document.createElement('div');numberHint.className='small';numberHint.textContent='自動採番・手動修正可';$('number').after(numberHint);document.querySelector('[data-config="diameters"] > label').textContent='基物の太さ（cm） — 1地点から追加可';document.querySelector('[data-config="ph"] > label').textContent='pH — 1地点から追加可';document.querySelector('[data-config="hardness"] > label').textContent='硬さ — 1地点から追加可';$('date').closest('.field').classList.add('date-field');$('number').closest('.field').classList.add('number-field');const mobileStyles=document.createElement('style');mobileStyles.textContent='input[type="date"]{min-width:0;max-width:100%;font-size:16px}input[type="date"]::-webkit-date-and-time-value{min-width:0;text-align:left}@media(max-width:600px){.date-field,.number-field{grid-column:1/-1}.date-field input{width:100%;min-height:48px}}';document.head.append(mobileStyles);init();
