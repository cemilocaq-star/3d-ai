import * as THREE from 'three';

export function buildPromptModel(prompt){
 const q=String(prompt||'').toLowerCase(),root=new THREE.Group(),m=new Map();
 const mat=c=>{if(!m.has(c))m.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.7}));return m.get(c)};
 const box=(name,x,y,z,a,b,c,color)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat(color));o.name=name;o.position.set(x,y,z);root.add(o);return o};
 const sphere=(name,x,y,z,a,b,c,color)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),mat(color));o.name=name;o.position.set(x,y,z);o.scale.set(a,b,c);root.add(o);return o};
 const cyl=(name,x,y,z,top,bottom,h,color,n=12)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,n),mat(color));o.name=name;o.position.set(x,y,z);root.add(o);return o};
 box('Display base',0,-.13,0,3.5,.22,3.5,0x29384b);
 let type='desk lamp';
 if(/robot|android|droid|робот|robotu/.test(q)){
  type='robot';
  box('Torso',0,1.35,0,1.05,1.15,.62,0x8298b2);box('Chest panel',0,1.42,.33,.62,.52,.08,0x26364b);box('Chest light',0,1.48,.39,.34,.08,.025,0x55d6d0);
  box('Neck',0,2.02,0,.28,.2,.28,0x26364b);box('Head',0,2.48,0,.86,.68,.68,0x8298b2);box('Face visor',0,2.5,.36,.68,.28,.07,0x26364b);
  sphere('Left eye',-.19,2.51,.415,.075,.075,.045,0x55d6d0);sphere('Right eye',.19,2.51,.415,.075,.075,.045,0x55d6d0);
  cyl('Antenna',.27,2.98,0,.035,.035,.28,0xe5a85b,8);sphere('Antenna tip',.27,3.14,0,.09,.09,.09,0xe5a85b);
  for(const d of [-1,1]){cyl('Shoulder',d*.72,1.72,0,.22,.22,.24,0x26364b).rotation.z=Math.PI/2;box('Upper arm',d*.83,1.32,0,.25,.66,.28,0x8298b2);sphere('Elbow',d*.83,.94,0,.16,.16,.16,0xe5a85b);box('Forearm',d*.83,.68,.02,.3,.45,.32,0x26364b);box('Leg',d*.29,.28,0,.34,.62,.38,0x8298b2);box('Foot',d*.29,-.06,.13,.42,.2,.62,0x26364b)}
 }else if(/house|home|villa|cabin|дом/.test(q)||q.split(/\\s+/).includes('ev')){
  type='modern house';box('Walls',0,.9,0,2.2,1.8,1.8,0xe4d9c4);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.65,.9,4),mat(0x9d5548));roof.name='Roof';roof.position.set(0,2.23,0);roof.rotation.y=Math.PI/4;root.add(roof);
  box('Door',0,.55,.92,.48,1.05,.08,0x654532);sphere('Door knob',.16,.56,1,.045,.045,.045,0xe4b95f);
  for(const x of [-.68,.68]){box('Window frame',x,1.12,.94,.48,.5,.08,0x314b63);box('Window glass',x,1.12,1,.36,.38,.035,0x72c4d4);box('Window divider',x,1.12,1.03,.035,.42,.025,0xe9e5d9)}
  box('Chimney',.68,2.55,-.35,.28,.8,.3,0x875b50);
 }else if(/tree|plant|ağac|agac|дерево/.test(q)){
  type='stylized tree';cyl('Trunk',0,.85,0,.22,.32,1.8,0x805333,10);
  sphere('Lower foliage',0,1.85,0,.95,.85,.9,0x3c8a55);sphere('Middle foliage',-.38,2.35,.02,.72,.72,.7,0x4caa65);sphere('Top foliage',.28,2.65,0,.62,.7,.62,0x64b86b);
  for(let i=0;i<5;i++)sphere('Fruit '+(i+1),Math.cos(i*1.25)*.48,2.05+(i%2)*.25,Math.sin(i*1.25)*.48,.09,.09,.09,0xe5a94d);
 }else if(/car|auto|vehicle|машин|maşın|masin|avtomobil/.test(q)){
  type='compact car';box('Chassis',0,.62,0,2.5,.48,1.18,0x3978b8);box('Hood',-.82,.85,0,.82,.2,1.12,0x4e91d1);box('Cabin',.28,1.12,0,1.2,.65,1.02,0x3978b8);box('Windshield',-.12,1.2,.53,.52,.43,.035,0x8bd0df);box('Rear glass',.68,1.2,.53,.42,.4,.035,0x8bd0df);
  for(const x of [-.82,.82])for(const z of [-.62,.62]){cyl('Tyre',x,.42,z,.29,.29,.16,0x202733,16).rotation.x=Math.PI/2;cyl('Hub',x,.42,z*1.14,.13,.13,.17,0xc1cbd5,12).rotation.x=Math.PI/2}
  box('Bumper',-1.3,.48,0,.12,.18,1.12,0xbac4cf);for(const z of [-.4,.4])box('Headlight',-1.27,.7,z,.05,.14,.2,0xf6df9a);
 }else if(/chair|stul|kreslo|стул/.test(q)){
  type='modern chair';box('Seat',0,1,0,1.2,.18,1.05,0xc58c55);box('Backrest',0,1.72,-.43,1.2,1.25,.16,0x4d7797);
  for(const x of [-.48,.48])for(const z of [-.4,.4])box('Leg',x,.48,z,.12,.9,.12,0x394b5f);
 }else{
  cyl('Lamp base',0,.05,0,.62,.62,.14,0x394b5f,24);cyl('Lamp stem',0,.68,0,.07,.09,1.15,0xb7c3d0,12);
  const arm=box('Angled arm',.32,1.28,0,.7,.09,.09,0xb7c3d0);arm.rotation.z=-.55;
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(.22,.62,.55,24,1,true),mat(0xe0ad55));shade.name='Lamp shade';shade.position.set(.63,1.42,0);shade.rotation.z=-.35;root.add(shade);
  sphere('Bulb',.63,1.12,0,.16,.16,.16,0xffe9a6);
 }
 root.name='Nova '+type;root.userData.generatedBy='Nova offline procedural builder';root.userData.modelType=type;return root;
}
