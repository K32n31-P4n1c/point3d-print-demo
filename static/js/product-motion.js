/** Browser-only demonstrations in the authored models' millimetre coordinates. */
function playback({button, render, labels, apply, restore, duration, loop=false}) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed=0, running=false, frame=0, previous=0;
  function label() {
    button.textContent=reduced.matches ? labels.reduced : running ? labels.running : labels.ready;
    if(loop)button.setAttribute('aria-pressed',String(running));
  }
  function pause() {
    cancelAnimationFrame(frame);frame=0;running=false;previous=0;label();
  }
  function tick(now) {
    if(!running)return;
    if(previous)elapsed+=Math.max((now-previous)/1000,0);
    previous=now;
    if(!loop)elapsed=Math.min(elapsed,duration);
    apply(elapsed);render();
    if(!loop && elapsed>=duration){pause();return;}
    frame=requestAnimationFrame(tick);
  }
  function play() {
    if(loop && running){pause();return;}
    if(!loop){pause();elapsed=0;}
    if(reduced.matches){
      elapsed=loop ? elapsed+duration/8 : duration;
      apply(elapsed);render();label();return;
    }
    running=true;previous=0;apply(elapsed);render();label();
    frame=requestAnimationFrame(tick);
  }
  function reset() {pause();elapsed=0;restore();render();}
  button.hidden=false;button.disabled=false;label();
  button.addEventListener('click',play);
  reduced.addEventListener('change',()=>{
    const finish=reduced.matches&&running&&!loop;
    pause();
    if(finish){elapsed=duration;apply(elapsed);render();}
    label();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',pause);
  return {play,pause,reset,get running(){return running;},get elapsed(){return elapsed;},
    get progress(){return loop ? (elapsed%duration)/duration : elapsed/duration;},
    stop(){pause();button.disabled=true;button.hidden=true;}};
}

export function setupBallMotion({THREE,model,render,button,mk}) {
  const ball=model.getObjectByName('Ball'),donut=model.getObjectByName('Donut');
  if(!button||!ball?.isMesh||!donut?.isMesh)return null;
  ball.geometry.computeBoundingBox();donut.geometry.computeBoundingBox();
  const center=ball.geometry.boundingBox.getCenter(new THREE.Vector3());
  const track=donut.geometry.boundingBox.getCenter(new THREE.Vector3());
  const radius=Math.hypot(center.x-track.x,center.z-track.z);
  const ballRadius=ball.geometry.boundingBox.getSize(new THREE.Vector3()).y/2;
  if(radius<=0||ballRadius<=0)return null;
  // Center only the browser geometry so the sphere rolls about its own center.
  ball.geometry=ball.geometry.clone();ball.geometry.translate(-center.x,-center.y,-center.z);
  ball.position.add(center);
  const original=ball.position.clone(),orientation=ball.quaternion.clone();
  const start=Math.atan2(original.z-track.z,original.x-track.x);
  const up=new THREE.Vector3(0,1,0),yaw=new THREE.Quaternion(),spin=new THREE.Quaternion();
  const rollingAxis=new THREE.Vector3(radius/ballRadius*Math.cos(start),1,radius/ballRadius*Math.sin(start));
  const spinRate=rollingAxis.length();rollingAxis.normalize();
  const duration=6;
  return playback({button,render,duration,loop:true,
    labels:mk ? {ready:'Заврти топче',running:'Стопирај топче',reduced:'Помести топче'} :
      {ready:'Roll the ball',running:'Stop the ball',reduced:'Move the ball'},
    apply(seconds){
      const angle=(seconds/duration)*Math.PI*2;
      ball.position.set(track.x+radius*Math.cos(start+angle),original.y,track.z+radius*Math.sin(start+angle));
      yaw.setFromAxisAngle(up,-angle);spin.setFromAxisAngle(rollingAxis,angle*spinRate);
      ball.quaternion.copy(yaw).multiply(spin).multiply(orientation);
    },
    restore(){ball.position.copy(original);ball.quaternion.copy(orientation);}
  });
}

// Area-weighted tread centers measured from the supplied dice-tower GLB.
// Entries are [X, floor Y, Z]; the funnel and lower tray connect the stairs.
const DICE_ROUTE=[
  [84,202,-138],[99,185,-128],[119,168.15,-114],
  [128.75,168.15,-112.91],[124.44,160.62,-101.62],[118.27,153.09,-91.17],
  [108.14,145.56,-84.57],[97,138.02,-79.76],[84.93,130.49,-80.37],
  [73.08,122.96,-83.01],[63.68,115.43,-90.61],[55.65,107.9,-99.71],
  [52.5,100.37,-111.38],[51.36,92.84,-123.47],[55.67,85.31,-134.76],
  [61.85,77.78,-145.21],[71.98,70.25,-151.8],[83.12,62.72,-156.63],
  [95.19,55.19,-156.02],[107.04,47.65,-153.38],[114.49,40.12,-143.34],
  [121.83,32.59,-135.15],[130.01,25.06,-129.46],[135.7,17.53,-120.96],
  [142.5,10,-116.52],[157,2.47,-110],[173,2.47,-102]
];

function makeDie(THREE,index,size) {
  const die=new THREE.Group();die.name=`ExampleDie${index+1}`;
  const body=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),
    new THREE.MeshStandardMaterial({color:index ? 0x9b87ff : 0xff4db8,roughness:.55}));
  die.add(body);
  const dotGeometry=new THREE.CircleGeometry(size*.065,16);
  const ink=new THREE.MeshStandardMaterial({color:0x17131c,roughness:.8});
  const p=size*.23,h=size/2+.012;
  const layouts=[[[0,0]],[[-p,-p],[p,p]],[[-p,-p],[0,0],[p,p]],
    [[-p,-p],[-p,p],[p,-p],[p,p]],
    [[-p,-p],[-p,p],[0,0],[p,-p],[p,p]],
    [[-p,-p],[-p,0],[-p,p],[p,-p],[p,0],[p,p]]];
  // Opposite faces sum to seven: +Z/-Z=1/6, +X/-X=2/5, +Y/-Y=3/4.
  const faces=[[[0,0,h],[0,0,0],0],[[0,0,-h],[0,Math.PI,0],5],
    [[h,0,0],[0,Math.PI/2,0],1],[[-h,0,0],[0,-Math.PI/2,0],4],
    [[0,h,0],[-Math.PI/2,0,0],2],[[0,-h,0],[Math.PI/2,0,0],3]];
  for(const [position,rotation,face] of faces){
    const dots=new THREE.Group();dots.position.set(...position);dots.rotation.set(...rotation);
    for(const [x,y] of layouts[face]){const dot=new THREE.Mesh(dotGeometry,ink);dot.position.set(x,y,0);dots.add(dot);}
    die.add(dots);
  }
  return die;
}

export function setupDiceMotion({THREE,model,render,button,mk}) {
  if(!button||!model.getObjectByName('Tower')||!model.getObjectByName('Railings'))return null;
  const group=new THREE.Group();group.name='ExampleDice';group.visible=false;model.add(group);
  const size=12,half=size/2,duration=6;
  const dice=[makeDie(THREE,0,size),makeDie(THREE,1,size)];group.add(...dice);
  const rolling=new THREE.Euler(),basis=new THREE.Matrix4();
  const settled=[new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,Math.PI/2,0)),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,Math.PI/2))];
  const route=DICE_ROUTE.map(point=>new THREE.Vector3(...point));
  function support(die) {
    basis.makeRotationFromQuaternion(die.quaternion);
    const e=basis.elements;
    return half*(Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]));
  }
  function pose(die,index,time) {
    const t=Math.max(0,time-index*.35);
    die.visible=time>=index*.35;
    if(t<.55){
      die.rotation.set(.3+t*2,.4+index+t, .2+t*3);
      die.position.set(84+index*4,250-(250-202-support(die))*(t/.55)**2,-138+index*2);
      return;
    }
    const travel=(t-.55)/.165;
    const segment=Math.min(Math.floor(travel),route.length-2),u=Math.min(travel-segment,1);
    const from=route[segment],to=route[segment+1];
    die.position.lerpVectors(from,to,u);
    // The rotating cube clears a riser before dropping onto the next tread.
    rolling.set(travel*Math.PI/2,travel*.37,Math.sin(travel*.8)*.7);
    die.quaternion.setFromEuler(rolling);
    const floor=from.y+(to.y-from.y)*Math.max(0,(u-.5)*2);
    die.position.y=floor+support(die)+4*Math.sin(Math.PI*u);
    if(travel>=route.length-1){
      const settle=Math.min((travel-(route.length-1))*.165/.7,1);
      const end=route[route.length-1];
      die.quaternion.slerp(settled[index],settle);
      die.position.set(end.x+index*5+10*settle,end.y+support(die),end.z+(index ? -31 : -9)*settle);
    }
  }
  return playback({button,render,duration,
    labels:mk ? {ready:'Пушти 2 коцки',running:'Пушти повторно',reduced:'Пушти 2 коцки'} :
      {ready:'Drop 2 dice',running:'Drop again',reduced:'Drop 2 dice'},
    apply(seconds){group.visible=true;dice.forEach((die,index)=>pose(die,index,seconds));},
    restore(){group.visible=false;dice.forEach(die=>{die.position.set(0,0,0);die.quaternion.identity();});}
  });
}
