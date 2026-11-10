import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {PLYLoader} from 'three/addons/loaders/PLYLoader.js';
import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {USDZLoader} from 'three/addons/loaders/USDZLoader.js';
import {ThreeMFLoader} from 'three/addons/loaders/3MFLoader.js';
import {buildPromptModel} from './prompt-model.js';

function collectResources(root){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 root?.traverse?.(node=>{
  if(node.geometry)geometries.add(node.geometry);
  const list=Array.isArray(node.material)?node.material:[node.material];
  list.filter(Boolean).forEach(material=>{
   materials.add(material);
   Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value)});
  });
 });
 return{geometries,materials,textures};
}
function disposeResources(resources,retainedRoot=null){
 const retained=collectResources(retainedRoot);
 resources.geometries.forEach(item=>{if(!retained.geometries.has(item))item.dispose()});
 resources.materials.forEach(item=>{if(!retained.materials.has(item))item.dispose()});
 resources.textures.forEach(item=>{if(!retained.textures.has(item))item.dispose()});
}
function disposeObject(root,retainedRoot=null){
 disposeResources(collectResources(root),retainedRoot);
}
function disposeReplacedMaterials(materials,retainedRoot){
 const resources={geometries:new Set(),materials:new Set(materials.filter(Boolean)),textures:new Set()};
 resources.materials.forEach(material=>Object.values(material).forEach(value=>{if(value?.isTexture)resources.textures.add(value)}));
 disposeResources(resources,retainedRoot);
}
function rounded(value){return Number.isFinite(value)?Math.round(value*1000)/1000:null}
function getDimensions(object){
 const bounds=new THREE.Box3().setFromObject(object);
 if(bounds.isEmpty())return null;
 const size=bounds.getSize(new THREE.Vector3());
 return{x:rounded(size.x),y:rounded(size.y),z:rounded(size.z)};
}
function findObjectByName(root,name){
 let match=null;
 root.traverse(node=>{if(!match&&node.name===name)match=node});
 return match;
}
function applySceneActions(root,actions){
 if(!root)return (Array.isArray(actions)?actions:[]).map(action=>({type:action.type,ok:false,reason:'No model is loaded'}));
 const results=[];
 for(const action of Array.isArray(actions)?actions:[]){
  let target=null;
  if(action.type!=='add_primitive'){
   if(action.objectId)root.traverse(node=>{if(!target&&node.isMesh&&node.uuid===action.objectId)target=node});
   if(!target)target=findObjectByName(root,action.objectName);
  }
  if(action.type==='add_primitive'){
   const geometries={
    box:()=>new THREE.BoxGeometry(1,1,1),
    sphere:()=>new THREE.SphereGeometry(.5,32,24),
    cylinder:()=>new THREE.CylinderGeometry(.5,.5,1,32),
    torus:()=>new THREE.TorusGeometry(.4,.14,16,48)
   };
   const geometry=geometries[action.primitive]?.();
   if(!geometry){results.push({type:action.type,ok:false,reason:'Unsupported primitive'});continue}
   const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:action.color}));
   object.name=action.name;
   object.position.set(action.position.x,action.position.y,action.position.z);
   object.scale.set(action.scale.x,action.scale.y,action.scale.z);
   root.add(object);
   results.push({type:action.type,ok:true,name:object.name});
   continue;
  }
  if(!target){results.push({type:action.type,ok:false,reason:'Object not found: '+action.objectName});continue}
  if(action.type==='rename_object'){
   target.name=action.name;
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='set_material_color'){
   const list=Array.isArray(target.material)?target.material:[target.material];
   const editable=list.filter(material=>material?.color?.set);
   if(!editable.length){results.push({type:action.type,ok:false,reason:'Object has no editable color material'});continue}
   const previous=list;
   const next=list.map(material=>{
    if(!material?.color?.set)return material;
    const copy=material.clone();
    copy.color.set(action.color);
    copy.needsUpdate=true;
    return copy;
   });
   target.material=Array.isArray(target.material)?next:next[0];
   disposeReplacedMaterials(previous,root);
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='set_material_properties'){
   const list=Array.isArray(target.material)?target.material:[target.material];
   const editable=list.filter(material=>material);
   if(!editable.length){results.push({type:action.type,ok:false,reason:'Object has no editable material'});continue}
   const next=editable.map(material=>material.clone());
   next.forEach(material=>{
    if(action.color&&material.color?.set)material.color.set(action.color);
    if(Number.isFinite(action.roughness)&&'roughness' in material)material.roughness=action.roughness;
    if(Number.isFinite(action.metalness)&&'metalness' in material)material.metalness=action.metalness;
    material.needsUpdate=true;
   });
   const previous=Array.isArray(target.material)?target.material:[target.material];
   target.material=Array.isArray(target.material)?next:next[0];
   disposeReplacedMaterials(previous,root);
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='set_transform'){
   if(action.position)target.position.set(action.position.x,action.position.y,action.position.z);
   if(action.rotation)target.rotation.set(
    THREE.MathUtils.degToRad(action.rotation.x),
    THREE.MathUtils.degToRad(action.rotation.y),
    THREE.MathUtils.degToRad(action.rotation.z)
   );
   if(action.scale)target.scale.set(action.scale.x,action.scale.y,action.scale.z);
   results.push({type:action.type,ok:true,name:target.name});
  }else if(action.type==='delete_object'){
   if(target===root||!target.parent){results.push({type:action.type,ok:false,reason:'The scene root cannot be deleted'});continue}
   target.parent.remove(target);
   disposeObject(target,root);
   results.push({type:action.type,ok:true,name:target.name});
  }else{
   results.push({type:action.type,ok:false,reason:'Unsupported scene action'});
  }
 }
 root.updateMatrixWorld(true);
 return results;
}
function measure(root){
 root.updateMatrixWorld(true);
 let meshes=0,vertices=0,triangles=0,uvMeshes=0,normalMeshes=0,vertexColorMeshes=0,skinnedMeshes=0,morphMeshes=0;
 const materials=new Set(),textures=new Set(),meshDetails=[];
 const hierarchy=[];
 const addHierarchy=(node,parentId=null,depth=0)=>{
  if(hierarchy.length>=200)return;
  hierarchy.push({id:node.uuid,parentId,name:(node.name||node.type||'Object').slice(0,80),kind:node.isMesh?'Mesh':node.type||'Object',depth,visible:node.visible});
  for(const child of node.children||[])addHierarchy(child,node.uuid,depth+1);
 };
 addHierarchy(root);
 root.traverse(node=>{
  if(!node.isMesh)return;
  meshes++;
  if(!node.name)node.name='Mesh '+meshes;
  const geometry=node.geometry;
  const attributes=geometry?.attributes||{};
  const vertexCount=attributes.position?.count||0;
  const triangleCount=Math.floor((geometry?.index?.count||vertexCount)/3);
  const hasUV=Boolean(attributes.uv);
  const hasNormals=Boolean(attributes.normal);
  const hasVertexColors=Boolean(attributes.color);
  const hasSkinning=Boolean(node.isSkinnedMesh);
  const morphTargets=Object.values(geometry?.morphAttributes||{}).some(list=>Array.isArray(list)&&list.length>0);
  vertices+=vertexCount;
  triangles+=triangleCount;
  if(hasUV)uvMeshes++;
  if(hasNormals)normalMeshes++;
  if(hasVertexColors)vertexColorMeshes++;
  if(hasSkinning)skinnedMeshes++;
  if(morphTargets)morphMeshes++;
  const meshMaterials=Array.isArray(node.material)?node.material:[node.material];
  const materialNames=[],materialColors=[];
  for(const material of meshMaterials.filter(Boolean)){
   materials.add(material);
   if(material.name)materialNames.push(material.name.slice(0,80));
   if(material.color?.isColor)materialColors.push('#'+material.color.getHexString());
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
  if(meshDetails.length<20){
   meshDetails.push({
    id:node.uuid,
    name:(node.name||'Mesh '+meshes).slice(0,80),
    visible:node.visible,
    geometryType:geometry?.type||'BufferGeometry',
    vertices:vertexCount,triangles:triangleCount,
    dimensions:getDimensions(node),
    hasUV,hasNormals,hasVertexColors,hasSkinning,morphTargets,
    materials:[...new Set(materialNames)].slice(0,4),
    materialColors:[...new Set(materialColors)].slice(0,4)
   });
  }
 });
 return{
  meshes,vertices,triangles,materials:materials.size,textures:textures.size,
  uvMeshes,normalMeshes,vertexColorMeshes,skinnedMeshes,morphMeshes,
  dimensions:getDimensions(root),meshDetails,hierarchy
 };
}

const ModelViewer=forwardRef(function ModelViewer({file,onLoaded=()=>{},onLoadProgress=()=>{}},ref){
 const host=useRef(null),state=useRef({}),[error,setError]=useState('');
 useEffect(()=>{
  const element=host.current;
  if(!element)return;
  const scene=new THREE.Scene();
  const selectionBox=new THREE.Box3Helper(new THREE.Box3(),0x79b8ff);
  selectionBox.visible=false;
  scene.add(selectionBox);
  let selectedMesh=null;
  let selectedMeshes=[];
  scene.background=new THREE.Color('#0b101a');
  const camera=new THREE.PerspectiveCamera(45,1,.01,10000);
  camera.position.set(4,3,5);
  const mobileViewport=window.matchMedia('(max-width: 680px)').matches;
  let renderer;
  try{
   renderer=new THREE.WebGLRenderer({antialias:!mobileViewport,alpha:false,powerPreference:'high-performance'});
  }catch{
   disposeObject(scene);
   setError('This browser could not start WebGL. Try a browser with hardware acceleration enabled or a newer device.');
   return ()=>{};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobileViewport?1.5:2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  element.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x354052,2));
  const light=new THREE.DirectionalLight(0xffffff,2.5);
  light.position.set(4,7,5);
  scene.add(light);
  let frame=0,running=false,elementVisible=true;
  const grid=new THREE.GridHelper(12,24,0x344158,0x202b3b);
  scene.add(grid);
  const resize=()=>{
   const width=element.clientWidth,height=element.clientHeight;
   if(!width||!height)return;
   const pixelRatio=Math.min(window.devicePixelRatio||1,window.matchMedia('(max-width: 680px)').matches?1.5:2);
   if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
   camera.aspect=width/height;
   camera.updateProjectionMatrix();
   renderer.setSize(width,height);
  };
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  observer?.observe(element);
  window.addEventListener('resize',resize);
  const animate=()=>{
   if(!running)return;
   frame=requestAnimationFrame(animate);
   controls.update();
   const visibleSelected=selectedMeshes.filter(mesh=>{
    let node=mesh;
    while(node){if(!node.visible)return false;node=node.parent}
    return true;
   });
   if(visibleSelected.length){
    selectionBox.box.makeEmpty();
    visibleSelected.forEach(mesh=>selectionBox.box.union(new THREE.Box3().setFromObject(mesh)));
    selectionBox.visible=true;
    selectionBox.updateMatrixWorld(true);
   }else selectionBox.visible=false;
   renderer.render(scene,camera);
  };
  const syncRendering=()=>{
   const shouldRun=!document.hidden&&elementVisible;
   if(shouldRun&&!running){running=true;resize();animate()}
   else if(!shouldRun&&running){running=false;cancelAnimationFrame(frame);frame=0}
  };
  const onVisibilityChange=()=>syncRendering();
  const onContextLost=event=>{
   event.preventDefault();
   running=false;
   cancelAnimationFrame(frame);
   frame=0;
   setError('The 3D graphics context was interrupted. Wait for the browser to restore it or reload the studio.');
  };
  const onContextRestored=()=>{
   setError('');
   resize();
   syncRendering();
  };
  renderer.domElement.addEventListener('webglcontextlost',onContextLost,false);
  renderer.domElement.addEventListener('webglcontextrestored',onContextRestored,false);
  document.addEventListener('visibilitychange',onVisibilityChange);
  let intersectionObserver=null;
  if(typeof IntersectionObserver!=='undefined'){
   intersectionObserver=new IntersectionObserver(entries=>{
    elementVisible=Boolean(entries[0]?.isIntersecting);
    syncRendering();
   },{threshold:0.01});
   intersectionObserver.observe(element);
  }
  resize();
  syncRendering();
  state.current={
   grid,current:null,scene,
   clear:()=>{
    const loaded=state.current.current;
    if(loaded){scene.remove(loaded);disposeObject(loaded)}
    state.current.current=null;
    selectedMesh=null;
    selectedMeshes=[];
    selectionBox.visible=false;
    onLoaded(null);
   },
   load:object=>{
    const previous=state.current.current;
    if(previous){scene.remove(previous);disposeObject(previous)}
    state.current.current=object;
    selectedMesh=null;
    selectedMeshes=[];
    selectionBox.visible=false;
    scene.add(object);
    const bounds=new THREE.Box3().setFromObject(object);
    if(!bounds.isEmpty()){
     const size=bounds.getSize(new THREE.Vector3());
     const center=bounds.getCenter(new THREE.Vector3());
     const max=Math.max(size.x,size.y,size.z)||1;
     object.position.sub(center);
     camera.position.set(max*1.8,max*1.35,max*1.8);
     camera.near=Math.max(max/1000,.001);
     camera.far=max*100;
     camera.updateProjectionMatrix();
     controls.target.set(0,0,0);
     controls.update();
    }
    onLoaded(measure(object));
   }
  };
  return()=>{
   running=false;
   cancelAnimationFrame(frame);
   document.removeEventListener('visibilitychange',onVisibilityChange);
   intersectionObserver?.disconnect();
   observer?.disconnect();
   window.removeEventListener('resize',resize);
   renderer.domElement.removeEventListener('webglcontextlost',onContextLost,false);
   renderer.domElement.removeEventListener('webglcontextrestored',onContextRestored,false);
   controls.dispose();
   const loaded=state.current.current;
   if(loaded){scene.remove(loaded);disposeObject(loaded)}
   disposeObject(scene);
   renderer.dispose();
   element.removeChild(renderer.domElement);
   state.current={};
  };
 },[onLoaded]);

 useImperativeHandle(ref,()=>({
  applyMaterialProperties(properties){
   const root=state.current.current;
   if(!root||!selectedMeshes.length)return {ok:false,reason:'Select at least one mesh first'};
   let changed=0;
   selectedMeshes.forEach(mesh=>{
    if(!mesh.material)return;
    const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const next=list.map(material=>{
     const copy=material.clone();
     if(properties.color&&copy.color?.set)copy.color.set(properties.color);
     if(Number.isFinite(properties.roughness)&&'roughness' in copy)copy.roughness=THREE.MathUtils.clamp(properties.roughness,0,1);
     if(Number.isFinite(properties.metalness)&&'metalness' in copy)copy.metalness=THREE.MathUtils.clamp(properties.metalness,0,1);
     copy.needsUpdate=true;
     return copy;
    });
    const previous=list;
    mesh.material=Array.isArray(mesh.material)?next:next[0];
    disposeReplacedMaterials(previous,root);
    changed++;
   });
   if(changed)onLoaded(measure(root));
   return {ok:changed>0,changed};
  },
  async applyTexture(file){
   const root=state.current.current;
   if(!root||!selectedMeshes.length||!file)return {ok:false,reason:'Select a mesh and an image first'};
   if(file.size>8*1024*1024)return {ok:false,reason:'For mobile performance, use an image smaller than 8 MB'};
   const eligible=selectedMeshes.filter(mesh=>mesh.geometry?.attributes?.uv);
   if(!eligible.length)return {ok:false,reason:'Selected meshes have no UV coordinates'};
   const url=URL.createObjectURL(file);
   try{
    const texture=await new THREE.TextureLoader().loadAsync(url);
    if((texture.image?.width||0)>4096||(texture.image?.height||0)>4096){texture.dispose();return {ok:false,reason:'Texture dimensions must be 4096 × 4096 pixels or smaller'}}
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.needsUpdate=true;
    const previousMaterials=[];
    eligible.forEach(mesh=>{
     const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
     previousMaterials.push(...source);
     const next=source.map(material=>{
      const copy=material.clone();
      copy.map=texture;
      copy.needsUpdate=true;
      return copy;
     });
     mesh.material=Array.isArray(mesh.material)?next:next[0];
    });
    disposeReplacedMaterials(previousMaterials,root);
    onLoaded(measure(root));
    return {ok:true,changed:eligible.length};
   }catch{
    return {ok:false,reason:'The selected image could not be loaded'};
   }finally{URL.revokeObjectURL(url)}
  },
  toggleGrid(){
   if(!state.current.grid)return false;
   state.current.grid.visible=!state.current.grid.visible;
   return state.current.grid.visible;
  },
  getDescendantMeshIds(objectId){
   const root=state.current.current;
   if(!root||typeof objectId!=='string')return [];
   let group=null;
   root.traverse(node=>{if(!group&&node.uuid===objectId)group=node});
   if(!group)return [];
   const ids=[];
   group.traverse(node=>{if(node.isMesh)ids.push(node.uuid)});
   return ids;
  },
  selectMeshes(meshIds){
   const root=state.current.current;
   if(!root||!Array.isArray(meshIds))return false;
   const ids=new Set(meshIds.filter(id=>typeof id==='string'));
   if(!ids.size){
    selectedMesh=null;
    selectedMeshes=[];
    selectionBox.box.makeEmpty();
    selectionBox.visible=false;
    return true;
   }
   let first=null;
   root.traverse(node=>{if(node.isMesh&&ids.has(node.uuid)&&!first)first=node});
   if(!first)return false;
   selectedMesh=first;
   selectedMeshes=[...ids].map(id=>{
    let match=null;
    root.traverse(node=>{if(!match&&node.isMesh&&node.uuid===id)match=node});
    return match;
   }).filter(Boolean);
   selectionBox.box.makeEmpty();
   selectedMeshes.filter(mesh=>mesh.visible).forEach(mesh=>selectionBox.box.union(new THREE.Box3().setFromObject(mesh)));
   selectionBox.visible=selectedMeshes.some(mesh=>mesh.visible);
   return true;
  },
  selectMesh(meshId){
   const root=state.current.current;
   if(!root||typeof meshId!=='string')return false;
   let match=null;
   root.traverse(node=>{if(!match&&node.isMesh&&node.uuid===meshId)match=node});
   if(!match)return false;
   selectedMesh=match;
   selectedMeshes=[match];
   selectionBox.box.setFromObject(match);
   selectionBox.visible=match.visible;
   return true;
  },
  toggleHierarchyVisibility(objectId){
   const root=state.current.current;
   if(!root||typeof objectId!=='string')return null;
   let match=null;
   root.traverse(node=>{if(!match&&node.uuid===objectId)match=node});
   if(!match)return null;
   match.visible=!match.visible;
   onLoaded(measure(root));
   return match.visible;
  },
  toggleMeshVisibility(meshId){
   const root=state.current.current;
   if(!root||typeof meshId!=='string')return null;
   let match=null;
   root.traverse(node=>{if(!match&&node.isMesh&&node.uuid===meshId)match=node});
   if(!match)return null;
   match.visible=!match.visible;
   if(selectedMesh===match&&!match.visible)selectionBox.visible=false;
   onLoaded(measure(root));
   return match.visible;
  },
  createModelFromPrompt(prompt){
   const clean=String(prompt||'').trim();
   if(!clean)return {ok:false,reason:'Describe the model you want to create.'};
   const model=buildPromptModel(clean);
   state.current.load(model);
   selectedMesh=null;selectedMeshes=[];
   const stats=measure(model);onLoaded(stats);
   return {ok:true,name:model.name,stats};
  },
  applyActions(actions){
   let root=state.current.current;
   if(!root&&Array.isArray(actions)&&actions.some(action=>action.type==='add_primitive')){
    root=new THREE.Group();
    root.name='Nova Generated Scene';
    state.current.current=root;
    state.current.scene.add(root);
   }
   const expanded=(Array.isArray(actions)?actions:[]).flatMap(action=>Array.isArray(action.objectIds)&&action.objectIds.length
    ? action.objectIds.map(objectId=>({...action,objectId,objectIds:undefined}))
    : [action]);
   const results=applySceneActions(root,expanded);
   if(root){
    selectedMeshes=selectedMeshes.filter(mesh=>root.getObjectByProperty('uuid',mesh.uuid)===mesh);
    selectedMesh=selectedMeshes[0]||null;
    onLoaded(measure(root));
   }
   return results;
  },
  clearScene(){
   state.current.clear?.();
  },
  async exportGLB(){
   const root=state.current.current;
   if(!root)throw new Error('Create or import a scene before exporting.');
   const exporter=new GLTFExporter();
   const result=await new Promise((resolve,reject)=>exporter.parse(root,resolve,reject,{binary:true}));
   const blob=new Blob([result],{type:'model/gltf-binary'});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement('a');
   anchor.href=url;
   anchor.download='nova-export.glb';
   anchor.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
   return true;
  }
 }),[onLoaded]);

 useEffect(()=>{
  if(!file||!state.current.load)return;
  let cancelled=false,failed=false;
  setError('');
  const extension=file.name.split('.').pop().toLowerCase();
  const url=URL.createObjectURL(file);
  const manager=new THREE.LoadingManager();
  const report=(loaded=0,total=0,phase='Loading model')=>{
   if(cancelled)return;
   const safeLoaded=Number.isFinite(loaded)?loaded:0;
   const safeTotal=Number.isFinite(total)?total:0;
   onLoadProgress({
    status:'loading',
    loaded:safeLoaded,
    total:safeTotal,
    percent:safeTotal>0?Math.max(0,Math.min(100,safeLoaded/safeTotal*100)):null,
    phase
   });
  };
  const done=object=>{
   if(cancelled){disposeObject(object);return}
   state.current.load(object);
   onLoadProgress({status:'loaded',percent:100});
   URL.revokeObjectURL(url);
  };
  const fail=error=>{
   if(cancelled||failed)return;
   failed=true;
   const message=error?.message||'Could not load this file. Check that the asset is valid and self-contained.';
   setError(message);
   onLoadProgress({status:'error',message});
   URL.revokeObjectURL(url);
  };
  manager.onProgress=(_resource,loaded,total)=>report(loaded,total,'Loading model resources');
  manager.onError=resource=>fail(new Error('A model resource could not be loaded: '+resource));
  const onProgress=event=>report(event?.loaded||0,event?.total||0,'Loading model');
  const load=async()=>{
   try{
    if(extension==='gltf'){
     report(0,file.size,'Reading glTF file');
     const source=await file.text();
     if(cancelled)return;
     const document=JSON.parse(source);
     const references=[
      ...(Array.isArray(document.buffers)?document.buffers:[]),
      ...(Array.isArray(document.images)?document.images:[])
     ].map(item=>item?.uri).filter(uri=>typeof uri==='string'&&!uri.startsWith('data:'));
     if(references.length){
      throw new Error('This .gltf file uses separate model or texture files. Export the asset as a single .glb file and import that on mobile.');
     }
     report(0,0,'Parsing glTF scene');
     new GLTFLoader(manager).parse(source,'',gltf=>done(gltf.scene),fail);
    }else if(extension==='glb'){
     new GLTFLoader(manager).load(url,gltf=>done(gltf.scene),onProgress,fail);
    }else if(extension==='fbx'){
     new FBXLoader(manager).load(url,done,onProgress,fail);
    }else if(extension==='obj'){
     new OBJLoader(manager).load(url,done,onProgress,fail);
    }else if(extension==='stl'||extension==='ply'){
     const loader=extension==='stl'?new STLLoader(manager):new PLYLoader(manager);
     loader.load(url,geometry=>{
      if(extension==='ply'&&geometry.hasAttribute('color')){
       done(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true})));
      }else{
       if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
       done(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x9aaec8,metalness:.25,roughness:.55})));
      }
     },onProgress,fail);
    }else if(extension==='dae'){
     new ColladaLoader(manager).load(url,collada=>done(collada.scene),onProgress,fail);
    }else if(extension==='usdz'){
     new USDZLoader(manager).load(url,done,onProgress,fail);
    }else if(extension==='3mf'){
     new ThreeMFLoader(manager).load(url,done,onProgress,fail);
    }else{
     fail(new Error('Unsupported 3D file format: .'+extension));
    }
   }catch(error){
    fail(error);
   }
  };
  load();
  return()=>{
   cancelled=true;
   URL.revokeObjectURL(url);
  };
 },[file,onLoaded,onLoadProgress]);

 return <div ref={host} style={{position:'absolute',inset:0}}>{error&&<div className="loaderror">{error}</div>}</div>;
});
export default ModelViewer;
