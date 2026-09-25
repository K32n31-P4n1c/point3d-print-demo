/* Public, browser-only simulation. This never connects to the private Django API. */
(() => {
  const seed = JSON.parse(document.querySelector('#studio-seed').textContent);
  const mk = document.documentElement.lang === 'mk';
  const words = mk ? {saved:'Зачувано во демото.',edit:'Уреди',add:'Додај филамент',duplicate:'Овој материјал, бренд и боја веќе постојат.',unknown:'Избери боја рачно за непознатото име.',reset:'Да ги вратиш почетните тест-податоци?',empty:'Нема резултати.',memory:'Зачувувањето во прелистувачот не е достапно. Промените важат само до освежување.',name:'Име',published:'Објавен',price:'Цена (ден.)',notes:'Интерни белешки',save:'Зачувај'} : {saved:'Saved in this demo.',edit:'Edit',add:'Add filament',duplicate:'This material, brand and color already exist.',unknown:'Choose a color manually for this unknown name.',reset:'Restore the original demo data?',empty:'No results.',memory:'Browser storage is unavailable. Changes last until refresh only.',name:'Name',published:'Published',price:'Price (MKD)',notes:'Internal notes',save:'Save'};
  const key = 'point3d-public-studio-v1';
  const clone = () => JSON.parse(JSON.stringify(seed));
  let state = clone(), editing = null, persistent = true;
  const status = document.querySelector('#demo-status');
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Array.isArray(saved.filaments) && Array.isArray(saved.models) && Array.isArray(saved.requests) && saved.version === 1) state = saved;
  } catch { persistent = false; }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { persistent = false; }
    status.textContent = persistent ? words.saved : words.memory;
  }
  const el = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const field = name => document.querySelector('#id_' + name);
  const form = document.querySelector('#demo-filament-form');
  const normalize = text => text.trim().toLocaleLowerCase().replace(/\s+/g,' ');
  const hexOK = value => /^#[0-9a-f]{6}$/i.test(value);
  const picker = document.querySelector('#color-picker');
  function lookup() {
    const brand = field('brand').selectedOptions[0]?.textContent;
    const name = normalize(field('color_name').value);
    const known = state.filaments.find(row => row.brand === brand && normalize(row.color_name) === name)?.hex_color || seed.colors[name];
    field('hex_color').value = known || '';
    document.querySelector('#color-status').textContent = name && !known ? words.unknown : '';
    field('hex_color').setCustomValidity('');
    if (known) picker.value = known;
  }
  field('color_name').addEventListener('input',lookup);field('brand').addEventListener('change',lookup);
  picker.addEventListener('input',() => {field('hex_color').value=picker.value;field('hex_color').setCustomValidity('');});
  field('hex_color').addEventListener('input',() => {field('hex_color').setCustomValidity('');if(hexOK(field('hex_color').value))picker.value=field('hex_color').value;});
  function clear() {editing=null;form.reset();field('hex_color').setCustomValidity('');document.querySelector('#cancel-edit').hidden=true;document.querySelector('#form-heading').textContent=words.add;document.querySelector('#color-status').textContent='';}
  document.querySelector('#cancel-edit').addEventListener('click',clear);
  function edit(row) {
    editing=row.id;
    for(const name of ['material','brand']) field(name).value=Array.from(field(name).options).find(option => option.textContent===row[name])?.value || '';
    for(const name of ['color_name','hex_color','level'])field(name).value=row[name];
    picker.value=row.hex_color;field('hex_color').setCustomValidity('');
    document.querySelector('#cancel-edit').hidden=false;document.querySelector('#form-heading').textContent=words.edit;
    document.querySelector('#add-filament').scrollIntoView();field('color_name').focus();
  }
  function renderStock() {
    const tbody=document.querySelector('#demo-stock');tbody.replaceChildren();
    const q=normalize(document.querySelector('#stock-search').value);
    const rows=state.filaments.filter(row => ['material','brand','level'].every(name => !document.querySelector('#filter-'+name).value || row[name]===document.querySelector('#filter-'+name).value) && normalize([row.material,row.brand,row.color_name].join(' ')).includes(q));
    rows.sort((a,b)=>(a.brand.localeCompare(b.brand)||a.color_name.localeCompare(b.color_name))*(document.querySelector('#filter-sort').value==='desc'?-1:1));
    for(const row of rows){
      const tr=el('tr');tr.append(el('td',row.material),el('td',row.brand));
      const color=el('td'),label=el('span');label.className='table-color';const swatch=el('i');if(hexOK(row.hex_color))swatch.style.setProperty('--swatch',row.hex_color);label.append(swatch,document.createTextNode(row.color_name));color.append(label);tr.append(color);
      const level=el('td'),badge=el('span',row.level);badge.className='level '+(['full','medium','low','empty'].includes(row.level)?row.level:'');level.append(badge);tr.append(level);
      const action=el('td'),button=el('button',words.edit);button.type='button';button.addEventListener('click',()=>edit(row));action.append(button);tr.append(action);tbody.append(tr);
    }
    if(!rows.length){const tr=el('tr'),td=el('td',words.empty);td.colSpan=5;tr.append(td);tbody.append(tr);}
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!hexOK(field('hex_color').value)){field('hex_color').setCustomValidity(words.unknown);field('hex_color').reportValidity();return;}
    const row={id:editing || crypto.randomUUID(),material:field('material').selectedOptions[0].textContent,brand:field('brand').selectedOptions[0].textContent,color_name:field('color_name').value.trim(),hex_color:field('hex_color').value.toUpperCase(),level:field('level').value};
    if(!row.color_name)return;
    if(state.filaments.some(other=>other.id!==editing && other.material===row.material && other.brand===row.brand && normalize(other.color_name)===normalize(row.color_name))){status.textContent=words.duplicate;return;}
    if(editing)state.filaments[state.filaments.findIndex(item=>item.id===editing)]=row;else state.filaments.push(row);
    save();clear();document.querySelector('#stock-search').value='';for(const name of ['material','brand','level'])document.querySelector('#filter-'+name).value='';renderStock();
  });
  document.querySelector('#demo-filters').addEventListener('input',renderStock);
  function input(labelText,value,type='text') {const label=el('label',labelText),node=el('input');node.type=type;node.value=value;label.append(node);return [label,node];}
  function renderOther() {
    const models=document.querySelector('#demo-models');models.replaceChildren();
    for(const model of state.models){const form=el('form');form.className='quote-form';const [label,name]=input(words.name,model.name);name.required=true;name.maxLength=160;const pub=el('label',words.published),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=model.published;pub.append(checkbox);const button=el('button',words.save);button.className='button';form.append(label,pub,button);form.addEventListener('submit',e=>{e.preventDefault();model.name=name.value.trim();model.published=checkbox.checked;save();});models.append(form);}
    const requests=document.querySelector('#demo-requests');requests.replaceChildren();
    for(const request of state.requests){const form=el('form');form.className='quote-form';form.append(el('h3',request.reference),el('p',request.description));const label=el('label',mk?'Статус':'Status'),select=el('select');const labels=mk?['Ново','Во разгледување','Понуда подготвена','Прифатено','Во печатење','Завршено','Откажано']:['New','Reviewing','Quote prepared','Accepted','Printing','Completed','Cancelled'];['new','reviewing','quoted','accepted','printing','completed','cancelled'].forEach((value,i)=>{const option=el('option',labels[i]);option.value=value;select.append(option);});select.value=request.status;label.append(select);const [priceLabel,price]=input(words.price,request.price,'number');price.min='0';price.step='0.01';const notesLabel=el('label',words.notes),notes=el('textarea');notes.value=request.notes;notes.maxLength=2000;notesLabel.append(notes);const button=el('button',words.save);button.className='button';form.append(label,priceLabel,notesLabel,button);form.addEventListener('submit',e=>{e.preventDefault();request.status=select.value;request.price=price.value;request.notes=notes.value;save();});requests.append(form);}
  }
  function tab() {const active=['models','requests'].includes(location.hash.slice(1))?location.hash.slice(1):'inventory';for(const name of ['inventory','models','requests'])document.querySelector('#'+name+'-panel').hidden=name!==active;document.querySelectorAll('.studio-nav a').forEach(a=>{a.classList.toggle('active',a.hash==='#'+active);});}
  document.querySelector('#reset-demo').addEventListener('click',()=>{if(confirm(words.reset)){state=clone();save();clear();renderStock();renderOther();}});
  window.addEventListener('hashchange',tab);renderStock();renderOther();tab();if(!persistent)status.textContent=words.memory;
})();
