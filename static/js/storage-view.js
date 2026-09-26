/** Removable storage lid; coordinates are millimetres in the authored model. */
export function setupStorage({THREE, model, camera, controls, render, button, mk}) {
  const base=model.getObjectByName('Base'), hat=model.getObjectByName('Hat'), body=model.getObjectByName('Body');
  const data=base?.userData.storage;
  if(!button || !data || !hat || !body)return null;
  const positions=base.geometry.attributes.position;
  const start=data.lid_vertex_start, lift=data.lift_mm;
  if(!Number.isInteger(start)||start<=0||start>=positions.count||!Number.isFinite(lift)||lift<=0)return null;
  const original=positions.array.slice();
  const originalHat=hat.position.y, originalBody=body.position.y;
  const sticks=new THREE.Group();sticks.name='ExampleIncenseSticks';
  const wood=new THREE.MeshStandardMaterial({color:0xc8a16b,roughness:.9});
  const coating=new THREE.MeshStandardMaterial({color:0x795444,roughness:1});
  for(let i=0;i<5;i++){
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,230,12),wood);
    shaft.rotation.z=Math.PI/2;shaft.position.set((i%2)*3-1.5,4.1,(i-2)*5);
    const incense=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,178,12),coating);
    incense.rotation.z=Math.PI/2;incense.position.set(-26+(i%2)*3-1.5,4.1,(i-2)*5);
    sticks.add(shaft,incense);
  }
  sticks.visible=false;model.add(sticks);
  let progress=0,open=false,frame=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function apply(value){
    const shift=lift*value;
    for(let i=start;i<positions.count;i++)positions.setY(i,original[i*3+1]+shift);
    positions.needsUpdate=true;base.geometry.computeBoundingBox();base.geometry.computeBoundingSphere();
    hat.position.y=originalHat+shift;body.position.y=originalBody+shift;
    sticks.visible=value>0;
    const focusDelta=(value-progress)*lift*model.scale.y*.5;
    controls.target.y+=focusDelta;camera.position.y+=focusDelta;
    progress=value;controls.update();render();
  }
  function setOpen(value,instant=false){
    cancelAnimationFrame(frame);open=value;
    button.setAttribute('aria-expanded',String(open));
    button.textContent=mk?(open?'Затвори складиште':'Отвори складиште'):(open?'Close storage':'Open storage');
    const from=progress,to=open?1:0;
    if(instant||reduced.matches){apply(to);return;}
    const beginning=performance.now();
    function step(now){const t=Math.min((now-beginning)/650,1);apply(from+(to-from)*(t*t*(3-2*t)));if(t<1)frame=requestAnimationFrame(step);}
    frame=requestAnimationFrame(step);
  }
  button.hidden=false;button.disabled=false;
  button.addEventListener('click',()=>setOpen(!open));
  const onReduced=()=>{if(reduced.matches)setOpen(open,true);};reduced.addEventListener('change',onReduced);
  return {setOpen,get open(){return open;},get progress(){return progress;},stop(){cancelAnimationFrame(frame);button.disabled=true;}};
}
