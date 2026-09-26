import { setupStorage } from './storage-view.js';
const host = document.querySelector('#viewer');
const status = document.querySelector('#viewer-status');
const language = host.dataset.language;
const mk = language === 'mk';
let config, renderer, scene, camera, controls, model, THREE, initialPosition;
let activePart, storageView;
const selections = new Map();
const error = () => {
  status.textContent = host.dataset.fallback;
  storageView?.stop();
  const poster = document.querySelector('#viewer-poster');
  if (poster) poster.hidden = false;
  if (renderer) renderer.domElement.hidden = true;
};

function setColor(part, filament) {
  selections.set(part.id, filament);
  if (!model || !filament) return;
  model.traverse(object => {
    if (!object.isMesh) return;
    let node = object;
    let match = config.mode === 'whole';
    while (node && !match) { match = node.name === part.node; node = node.parent; }
    if (match) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.color.set(filament.hex);
    }
  });
  render();
}

function selectPart(id) {
  activePart = id;
  document.querySelectorAll('.part-control').forEach(el => el.classList.toggle('selected-part', Number(el.dataset.partId) === id));
}

function buildOptions() {
  for (const part of config.parts) {
    const select = document.querySelector(`[data-part="${part.id}"]`);
    const container = select.closest('.part-control');
    const swatches = container.querySelector('.swatches');
    const material = document.createElement('select');
    material.className = 'material-filter';
    material.setAttribute('aria-label', `${part.name}: ${mk ? 'Материјал' : 'Material'}`);
    const all = document.createElement('option'); all.value = ''; all.textContent = mk ? 'Сите материјали' : 'All materials'; material.append(all);
    for (const name of [...new Set(part.filaments.map(f => f.material))]) {
      const option = document.createElement('option'); option.value = name; option.textContent = name; material.append(option);
    }
    select.before(material);
    const originalValue = select.value;
    function refresh() {
      const old = select.value;
      select.replaceChildren(); swatches.replaceChildren();
      const empty = document.createElement('option'); empty.value = ''; empty.textContent = mk ? 'Избери филамент' : 'Choose filament'; select.append(empty);
      for (const filament of part.filaments.filter(f => !material.value || f.material === material.value)) {
        const option = document.createElement('option'); option.value = filament.id; option.textContent = `${filament.material} · ${filament.brand} · ${filament.color}`; select.append(option);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'swatch';
        button.style.setProperty('--swatch', filament.hex); button.dataset.filament = filament.id;
        button.title = option.textContent; button.setAttribute('aria-label',option.textContent); button.setAttribute('aria-pressed','false');
        button.addEventListener('click', () => { select.value = String(filament.id); select.dispatchEvent(new Event('change',{bubbles:true})); });
        swatches.append(button);
      }
      if ([...select.options].some(o => o.value === old)) select.value = old;
      if (!part.filaments.length) empty.textContent = mk ? 'Нема достапни бои' : 'No colors available';
      update();
    }
    function update() {
      const filament = part.filaments.find(f => String(f.id) === select.value);
      swatches.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.filament === select.value)));
      selectPart(part.id);
      setColor(part,filament);
    }
    material.addEventListener('change',refresh); select.addEventListener('change',update);
    select.addEventListener('focus',() => selectPart(part.id));
    refresh();
    if (originalValue) {select.value = originalValue; update();}
  }
}

function render() { if (renderer && scene && camera) renderer.render(scene,camera); }

async function start3D() {
  THREE = await import('three');
  const [{OrbitControls},{GLTFLoader}] = await Promise.all([
    import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js')
  ]);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38,1,0.01,1000);
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', mk ? '3Д модел. Стрелки за ротација, + и - за зумирање.' : '3D model. Arrow keys rotate; + and - zoom.');
  scene.add(new THREE.HemisphereLight(0xffffff,0x777777,1.3));
  const key = new THREE.DirectionalLight(0xffffff,2);key.position.set(4,6,5);scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff,1);fill.position.set(-5,2,-2);scene.add(fill);
  const gltf = await new GLTFLoader().loadAsync(config.glb);
  model = gltf.scene;
  model.traverse(object => {
    if (object.isMesh) {
      if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
      const neutral = material => new THREE.MeshStandardMaterial({color:material.color,roughness:.64,metalness:0,side:THREE.DoubleSide});
      object.material = Array.isArray(object.material) ? object.material.map(neutral) : neutral(object.material);
    }
  });
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x,size.y,size.z);
  if (!Number.isFinite(longest) || longest <= 0) throw new Error('Empty model');
  model.scale.multiplyScalar(2.8/longest);
  bounds = new THREE.Box3().setFromObject(model);
  model.position.sub(bounds.getCenter(new THREE.Vector3()));
  scene.add(model);
  const grid = new THREE.GridHelper(15,24,0x44354f,0x27232c);
  grid.position.y = -bounds.getSize(new THREE.Vector3()).y/2-.025;
  grid.material.transparent = true;grid.material.opacity = .4;scene.add(grid);
  camera.position.set(4,2.7,5);initialPosition = camera.position.clone();
  controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = false;controls.enablePan = false;controls.minDistance = 2.5;controls.maxDistance = 13;
  controls.maxPolarAngle = Math.PI*.9;controls.addEventListener('change',render);
  host.append(renderer.domElement);
  const resize = () => { const width=host.clientWidth,height=host.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render(); };
  new ResizeObserver(resize).observe(host);resize();
  // Replace the static preview only after the first successful WebGL render.
  const poster = document.querySelector('#viewer-poster');
  if (poster) poster.hidden = true;
  status.textContent = '';
  for (const part of config.parts) setColor(part,selections.get(part.id));
  storageView=setupStorage({THREE,model,camera,controls,render,button:document.querySelector('#toggle-storage'),mk});
  const raycaster = new THREE.Raycaster();
  let down;
  renderer.domElement.addEventListener('pointerdown',e => {down={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e => {
    if (!down || Math.hypot(e.clientX-down.x,e.clientY-down.y)>5) return;
    const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hit=raycaster.intersectObject(model,true)[0];
    if (!hit) return;
    let node=hit.object;
    let part=config.mode==='whole'?config.parts[0]:null;
    while(node&&!part){part=config.parts.find(p=>p.node===node.name);node=node.parent;}
    if(part){selectPart(part.id);document.querySelector(`[data-part="${part.id}"]`).focus({preventScroll:true});}
  });
  renderer.domElement.addEventListener('keydown',e => {
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')spherical.theta-=.12;
    else if(e.key==='ArrowRight')spherical.theta+=.12;
    else if(e.key==='ArrowUp')spherical.phi=Math.max(.15,spherical.phi-.12);
    else if(e.key==='ArrowDown')spherical.phi=Math.min(Math.PI*.9,spherical.phi+.12);
    else if(e.key==='+'||e.key==='=')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);
    else if(e.key==='-')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.1);
    else return;
    e.preventDefault();camera.position.setFromSpherical(spherical).add(controls.target);controls.update();render();
  });
  document.querySelector('#reset-view').addEventListener('click',()=>{storageView?.setOpen(false,true);camera.position.copy(initialPosition);controls.target.set(0,0,0);controls.update();render();});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();error();});
  window.point3dViewer={get camera(){return camera;},get model(){return model;},get renderer(){return renderer;},get storage(){return storageView;}};
}

try {
  const response = await fetch(host.dataset.config);
  if (!response.ok) throw new Error('Configuration unavailable');
  config = await response.json();buildOptions();
  await start3D();
} catch (e) { error(); }
